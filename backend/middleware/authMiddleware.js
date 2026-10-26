const jwt = require('jsonwebtoken')
const db = require('../config/database')
const { jwtSecret } = require('../config/auth')

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  try {
    const payload = jwt.verify(token, jwtSecret)
    req.userId = payload.sub
    return next()
  } catch {
    return res
      .status(401)
      .json({ message: 'Your session has expired. Please sign in again.' })
  }
}

const requireRole = (...allowedRoles) => (req, res, next) => {
  try {
    const user = db
      .prepare('SELECT role FROM users WHERE id = ?')
      .get(req.userId)

    if (!user) {
      return res.status(401).json({ message: 'Account not found.' })
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        message: 'You do not have permission to perform this action.',
      })
    }

    req.userRole = user.role
    return next()
  } catch (error) {
    console.error('Role check error:', error)
    return res.status(500).json({
      message: 'Could not verify your permissions. Please try again.',
    })
  }
}

module.exports = { requireAuth, requireRole }
