const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const db = require('../config/database')
const { hashPassword, verifyPassword } = require('../utils/password')
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
    const exists = db
      .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
      .get(cleanUsername)

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
    }

    db.prepare(
      `INSERT INTO users (id, full_name, username, password_hash, role)
       VALUES (@id, @full_name, @username, @password_hash, @role)`,
    ).run(user)

    const created = db
      .prepare('SELECT id, full_name, username, role, created_at FROM users WHERE id = ?')
      .get(user.id)

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
    const user = db
      .prepare(
        'SELECT id, full_name, username, role, password_hash, created_at FROM users WHERE LOWER(username) = LOWER(?)',
      )
      .get(cleanUsername)

    if (!user || !verifyPassword(cleanPassword, user.password_hash)) {
      return res
        .status(401)
        .json({ message: 'Invalid username, email, or password.' })
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
    const user = db
      .prepare(
        'SELECT id, full_name, username, role, created_at FROM users WHERE id = ?',
      )
      .get(req.userId)

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

module.exports = { register, login, getMe }
