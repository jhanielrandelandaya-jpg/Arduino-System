const jwt = require('jsonwebtoken')
const { getDatabase } = require('../config/database')
const { hashPassword, verifyPassword } = require('../utils/password')
const {
  ensureUserSettings,
  mapUserSettings,
} = require('../utils/userSettings')
const { jwtSecret, jwtExpiresIn } = require('../config/auth')

const ROLES = ['Student', 'Faculty']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/

const sanitizeUser = (user) => ({
  id: user.id,
  fullName: user.full_name || user.fullName,
  username: user.username,
  role: user.role,
  createdAt: user.created_at || user.createdAt,
})

const createToken = (user) =>
  jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: jwtExpiresIn })

const findUserByUsername = async (username, excludeId) => {
  const database = await getDatabase()
  const pattern = new RegExp(
    `^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
    'i',
  )
  const filter = { username: pattern }
  if (excludeId) {
    filter.id = { $ne: excludeId }
  }
  return database.collection('users').findOne(filter)
}

const register = async (req, res) => {
  const { fullName, username, password, role } = req.body || {}

  const cleanName = typeof fullName === 'string' ? fullName.trim() : ''
  const cleanUsername =
    typeof username === 'string' ? username.trim() : ''
  const cleanPassword = typeof password === 'string' ? password : ''
  const cleanRole = ROLES.includes(role) ? role : 'Student'

  if (cleanName.length < 2) {
    return res
      .status(400)
      .json({ message: 'Please enter your full name (at least 2 characters).' })
  }

  if (cleanUsername.length < 3) {
    return res.status(400).json({
      message: 'Please enter a username or email with at least 3 characters.',
    })
  }

  const isEmail = cleanUsername.includes('@')

  if (isEmail && !EMAIL_PATTERN.test(cleanUsername)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' })
  }

  if (!isEmail && !USERNAME_PATTERN.test(cleanUsername)) {
    return res.status(400).json({
      message:
        'Usernames can only contain letters, numbers, dots, underscores, and hyphens.',
    })
  }

  if (cleanPassword.length < 8) {
    return res
      .status(400)
      .json({ message: 'Password must be at least 8 characters.' })
  }

  try {
    const exists = await findUserByUsername(cleanUsername)
    if (exists) {
      return res.status(409).json({
        message: 'An account with that username or email already exists.',
      })
    }

    const user = {
      id: crypto.randomUUID(),
      full_name: cleanName,
      username: cleanUsername,
      password_hash: hashPassword(cleanPassword),
      role: cleanRole,
      created_at: new Date().toISOString(),
    }

    const database = await getDatabase()
    await database.collection('users').insertOne({
      _id: user.id,
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      password_hash: user.password_hash,
      role: user.role,
      created_at: user.created_at,
    })

    const created = await database
      .collection('users')
      .findOne({ id: user.id })

    return res.status(201).json({
      message: 'Account created successfully.',
      token: createToken(created),
      user: sanitizeUser(created),
    })
  } catch (error) {
    console.error('Register error:', error)
    return res
      .status(500)
      .json({ message: 'Could not create your account. Please try again.' })
  }
}

const login = async (req, res) => {
  const { username, password } = req.body || {}
  const cleanUsername =
    typeof username === 'string' ? username.trim().toLowerCase() : ''
  const cleanPassword = typeof password === 'string' ? password : ''

  if (!cleanUsername || !cleanPassword) {
    return res
      .status(400)
      .json({ message: 'Enter your username or email and password.' })
  }

  try {
    const database = await getDatabase()
    const user = await database
      .collection('users')
      .findOne({
        username: new RegExp(
          `^${cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i',
        ),
      })

    if (!user || !verifyPassword(cleanPassword, user.password_hash)) {
      return res.status(401).json({ message: 'Invalid username, email, or password.' })
    }

    return res.json({
      message: 'Signed in successfully.',
      token: createToken(user),
      user: sanitizeUser(user),
    })
  } catch (error) {
    console.error('Login error:', error)
    return res
      .status(500)
      .json({ message: 'Could not sign you in. Please try again.' })
  }
}

const getMe = async (req, res) => {
  try {
    const database = await getDatabase()
    const user = await database
      .collection('users')
      .findOne({ id: req.userId })

    if (!user) {
      return res.status(401).json({ message: 'Account not found.' })
    }

    return res.json({ user: sanitizeUser(user) })
  } catch (error) {
    console.error('Session error:', error)
    return res
      .status(500)
      .json({ message: 'Could not load your account. Please try again.' })
  }
}

const updateProfile = async (req, res) => {
  const { fullName, username } = req.body || {}
  const cleanName = typeof fullName === 'string' ? fullName.trim() : ''
  const cleanUsername =
    typeof username === 'string' ? username.trim() : ''

  if (cleanName.length < 2) {
    return res
      .status(400)
      .json({ message: 'Please enter your full name (at least 2 characters).' })
  }

  if (cleanUsername.length < 3) {
    return res.status(400).json({
      message: 'Please enter a username or email with at least 3 characters.',
    })
  }

  const isEmail = cleanUsername.includes('@')

  if (isEmail && !EMAIL_PATTERN.test(cleanUsername)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' })
  }

  if (!isEmail && !USERNAME_PATTERN.test(cleanUsername)) {
    return res.status(400).json({
      message:
        'Usernames can only contain letters, numbers, dots, underscores, and hyphens.',
    })
  }

  try {
    const exists = await findUserByUsername(cleanUsername, req.userId)
    if (exists) {
      return res.status(409).json({
        message: 'An account with that username or email already exists.',
      })
    }

    const database = await getDatabase()
    await database.collection('users').updateOne(
      { id: req.userId },
      { $set: { full_name: cleanName, username: cleanUsername } },
    )

    const updated = await database
      .collection('users')
      .findOne({ id: req.userId })

    return res.json({
      message: 'Profile updated.',
      user: sanitizeUser(updated),
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return res
      .status(500)
      .json({ message: 'Could not update your profile. Please try again.' })
  }
}

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  const cleanCurrent =
    typeof currentPassword === 'string' ? currentPassword : ''
  const cleanNew = typeof newPassword === 'string' ? newPassword : ''

  if (!cleanCurrent || !cleanNew) {
    return res
      .status(400)
      .json({ message: 'Enter your current and new password.' })
  }

  if (cleanNew.length < 8) {
    return res
      .status(400)
      .json({ message: 'Your new password must be at least 8 characters.' })
  }

  if (cleanCurrent === cleanNew) {
    return res.status(400).json({
      message: 'Choose a new password that is different from your current one.',
    })
  }

  try {
    const database = await getDatabase()
    const user = await database
      .collection('users')
      .findOne({ id: req.userId })

    if (!user || !verifyPassword(cleanCurrent, user.password_hash)) {
      return res
        .status(400)
        .json({ message: 'Your current password is incorrect.' })
    }

    await database.collection('users').updateOne(
      { id: req.userId },
      { $set: { password_hash: hashPassword(cleanNew) } },
    )

    return res.json({ message: 'Password updated successfully.' })
  } catch (error) {
    console.error('Change password error:', error)
    return res
      .status(500)
      .json({ message: 'Could not update your password. Please try again.' })
  }
}

const getSettings = async (req, res) => {
  try {
    const settings = await ensureUserSettings(req.userId)
    return res.json({ settings: mapUserSettings(settings) })
  } catch (error) {
    console.error('Load settings error:', error)
    return res
      .status(500)
      .json({ message: 'Could not load your settings. Please try again.' })
  }
}

const updateSettings = async (req, res) => {
  const body = req.body || {}

  try {
    const database = await getDatabase()
    const current = await ensureUserSettings(req.userId)
    const next = {
      classUpdates:
        typeof body.classUpdates === 'boolean'
          ? body.classUpdates
          : Boolean(current.notify_classes),
      quizUpdates:
        typeof body.quizUpdates === 'boolean'
          ? body.quizUpdates
          : Boolean(current.notify_quizzes),
      reminders:
        typeof body.reminders === 'boolean'
          ? body.reminders
          : Boolean(current.notify_reminders),
    }

    await database.collection('user_settings').updateOne(
      { user_id: req.userId },
      {
        $set: {
          notify_classes: next.classUpdates,
          notify_quizzes: next.quizUpdates,
          notify_reminders: next.reminders,
          updated_at: new Date().toISOString(),
        },
      },
    )

    return res.json({
      message: 'Notification preferences saved.',
      settings: next,
    })
  } catch (error) {
    console.error('Update settings error:', error)
    return res
      .status(500)
      .json({ message: 'Could not save your settings. Please try again.' })
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  getSettings,
  updateSettings,
}
