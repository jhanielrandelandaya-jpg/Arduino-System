const Database = require('better-sqlite3')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')

const dataDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

const dbPath =
  process.env.DATABASE_PATH || path.join(dataDir, 'learnspace.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const resetLegacyLearningSchema = () => {
  const classes = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'classes'")
    .get()
  if (!classes) return

  const columns = db.prepare('PRAGMA table_info(classes)').all()
  const names = columns.map((column) => column.name)
  if (!names.includes('teacher_id') || names.includes('faculty_id')) return

  db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS student_notes;
      DROP TABLE IF EXISTS submissions;
      DROP TABLE IF EXISTS classwork;
      DROP TABLE IF EXISTS lessons;
      DROP TABLE IF EXISTS topics;
      DROP TABLE IF EXISTS subjects;
      DROP TABLE IF EXISTS class_announcement_comments;
      DROP TABLE IF EXISTS class_announcements;
      DROP TABLE IF EXISTS quizzes;
      DROP TABLE IF EXISTS slides;
      DROP TABLE IF EXISTS enrollments;
      DROP TABLE IF EXISTS activity_logs;
      DROP TABLE IF EXISTS classes;
    `)
  })()
}

resetLegacyLearningSchema()

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Student','Faculty')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    class_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    subject_code TEXT NOT NULL,
    term TEXT,
    academic_year TEXT,
    description TEXT,
    class_code TEXT NOT NULL UNIQUE,
    join_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'Published',
    accent TEXT NOT NULL DEFAULT 'blue',
    faculty_id TEXT NOT NULL,
    created_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(faculty_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
    enrolled_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(student_id, class_id),
    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    quiz_title TEXT NOT NULL,
    class_id TEXT NOT NULL,
    subject_code TEXT,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'Draft',
    time_limit INTEGER NOT NULL DEFAULT 15,
    max_score INTEGER NOT NULL DEFAULT 100,
    passing INTEGER NOT NULL DEFAULT 75,
    questions INTEGER NOT NULL DEFAULT 1,
    attempts_allowed INTEGER NOT NULL DEFAULT 2,
    attempts INTEGER NOT NULL DEFAULT 0,
    average REAL,
    questions_json TEXT,
    created_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    score INTEGER NOT NULL CHECK(score >= 0 AND score <= 100),
    passed INTEGER NOT NULL CHECK(passed IN (0, 1)),
    correct_count INTEGER NOT NULL,
    question_count INTEGER NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS slides (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Published','Draft')),
    created_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS class_announcements (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    message TEXT NOT NULL CHECK(length(trim(message)) > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS class_announcement_comments (
    id TEXT PRIMARY KEY,
    announcement_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    message TEXT NOT NULL CHECK(length(trim(message)) > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(announcement_id) REFERENCES class_announcements(id) ON DELETE CASCADE,
    FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS classwork (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('assignment','quiz','material')),
    title TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    due_at TEXT,
    status TEXT NOT NULL DEFAULT 'Published' CHECK(status IN ('Published','Draft')),
    quiz_id TEXT,
    attachment_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    classwork_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'assigned'
      CHECK(status IN ('assigned','turned_in','graded','returned')),
    grade REAL CHECK(grade IS NULL OR (grade >= 0 AND grade <= 100)),
    submission_text TEXT NOT NULL DEFAULT '',
    file_id TEXT,
    file_name TEXT,
    file_mime_type TEXT,
    file_size INTEGER,
    submitted_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(classwork_id, student_id),
    FOREIGN KEY(classwork_id) REFERENCES classwork(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    message TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT,
    class_id TEXT,
    quiz_id TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    notify_classes INTEGER NOT NULL DEFAULT 1,
    notify_quizzes INTEGER NOT NULL DEFAULT 1,
    notify_reminders INTEGER NOT NULL DEFAULT 1,
    notifications_read_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    page TEXT,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_classes_faculty ON classes(faculty_id);
  CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
  CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id);
  CREATE INDEX IF NOT EXISTS idx_quizzes_class ON quizzes(class_id);
  CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id, submitted_at DESC);
  CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON quiz_attempts(student_id, quiz_id);
  CREATE INDEX IF NOT EXISTS idx_slides_class ON slides(class_id);
  CREATE INDEX IF NOT EXISTS idx_class_announcements_class_created
    ON class_announcements(class_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_announcement_comments_announcement_created
    ON class_announcement_comments(announcement_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_classwork_class_status_due
    ON classwork(class_id, status, due_at);
  CREATE INDEX IF NOT EXISTS idx_classwork_quiz ON classwork(quiz_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_student_status
    ON submissions(student_id, status);
  CREATE INDEX IF NOT EXISTS idx_submissions_classwork_status
    ON submissions(classwork_id, status);
  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_class ON activity_logs(class_id);
  CREATE INDEX IF NOT EXISTS idx_support_user ON support_tickets(user_id);
`)

const classColumns = db.prepare('PRAGMA table_info(classes)').all()
if (!classColumns.some((column) => column.name === 'join_code')) {
  db.exec('ALTER TABLE classes ADD COLUMN join_code TEXT')
}

const joinCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const generateJoinCode = () =>
  Array.from(
    { length: 8 },
    () => joinCodeAlphabet[crypto.randomInt(joinCodeAlphabet.length)],
  ).join('')

const assignMissingJoinCodes = db.transaction(() => {
  const missingClasses = db
    .prepare("SELECT id FROM classes WHERE join_code IS NULL OR join_code = ''")
    .all()
  const assignCode = db.prepare('UPDATE classes SET join_code = ? WHERE id = ?')
  for (const learningClass of missingClasses) {
    let joinCode
    do {
      joinCode = generateJoinCode()
    } while (db.prepare('SELECT 1 FROM classes WHERE join_code = ?').get(joinCode))
    assignCode.run(joinCode, learningClass.id)
  }
})
assignMissingJoinCodes()

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_join_code
    ON classes(join_code);
`)

module.exports = db
