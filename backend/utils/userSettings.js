const { getDatabase } = require('../config/database')

const DEFAULT_SETTINGS = () => ({
  notify_classes: true,
  notify_quizzes: true,
  notify_reminders: true,
  notifications_read_at: null,
  updated_at: new Date().toISOString(),
})

const ensureUserSettings = async (userId) => {
  const database = await getDatabase()
  const userSettings = database.collection('user_settings')
  const settings = await userSettings.findOne({ user_id: userId })

  if (settings) {
    return settings
  }

  const created = await userSettings.insertOne({
    user_id: userId,
    ...DEFAULT_SETTINGS(),
  })

  return { user_id: userId, _id: created.insertedId, ...DEFAULT_SETTINGS() }
}

const mapUserSettings = (settings) => ({
  classUpdates: Boolean(settings?.notify_classes),
  quizUpdates: Boolean(settings?.notify_quizzes),
  reminders: Boolean(settings?.notify_reminders),
})

module.exports = { ensureUserSettings, mapUserSettings }
