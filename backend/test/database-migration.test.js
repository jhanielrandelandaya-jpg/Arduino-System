const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const Database = require('better-sqlite3')

test('legacy learning data is archived instead of deleted on startup', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'learnspace-migration-'))
  const databasePath = path.join(directory, 'legacy.sqlite')

  try {
    const legacyDb = new Database(databasePath)
    legacyDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL
      );
      CREATE TABLE classes (
        id TEXT PRIMARY KEY,
        class_name TEXT NOT NULL,
        teacher_id TEXT NOT NULL
      );
      CREATE TABLE enrollments (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id)
      );
      CREATE INDEX idx_legacy_enrollments_class ON enrollments(class_id);
      INSERT INTO users VALUES ('teacher-1', 'Teacher', 'teacher', 'hash', 'Faculty');
      INSERT INTO classes VALUES ('class-1', 'Legacy Class', 'teacher-1');
      INSERT INTO enrollments VALUES ('enrollment-1', 'class-1');
    `)
    legacyDb.close()

    const startup = spawnSync(
      process.execPath,
      ['-e', "require('./config/database').close()"],
      {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, DATABASE_PATH: databasePath },
        encoding: 'utf8',
      },
    )
    assert.equal(startup.status, 0, startup.stderr)

    const migratedDb = new Database(databasePath)
    const archivedClasses = migratedDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'legacy_backup_classes_%'")
      .get()
    const archivedEnrollments = migratedDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'legacy_backup_enrollments_%'")
      .get()

    assert.ok(archivedClasses)
    assert.ok(archivedEnrollments)
    assert.equal(
      migratedDb
        .prepare(`SELECT class_name FROM "${archivedClasses.name}" WHERE id = ?`)
        .pluck()
        .get('class-1'),
      'Legacy Class',
    )
    assert.equal(
      migratedDb
        .prepare(`SELECT id FROM "${archivedEnrollments.name}" WHERE id = ?`)
        .pluck()
        .get('enrollment-1'),
      'enrollment-1',
    )
    assert.equal(migratedDb.prepare('SELECT COUNT(*) AS count FROM classes').get().count, 0)
    assert.ok(
      migratedDb
        .prepare('PRAGMA table_info(classes)')
        .all()
        .some((column) => column.name === 'faculty_id'),
    )
    assert.deepEqual(migratedDb.pragma('foreign_key_check'), [])
    migratedDb.close()
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
