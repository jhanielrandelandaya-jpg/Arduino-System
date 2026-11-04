const db = require('../config/database')

const ensureUserSettings = (userId) => {
  db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(
    userId,
  )

  return db
    .prepare('SELECT * FROM user_settings WHERE user_id = ?')
    .get(userId)
}

const mapUserSettings = (row) => ({
  classUpdates: Boolean(row?.notify_classes),
  quizUpdates: Boolean(row?.notify_quizzes),
  reminders: Boolean(row?.notify_reminders),
})

module.exports = { ensureUserSettings, mapUserSettings }
