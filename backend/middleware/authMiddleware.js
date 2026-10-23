const jwt = require('jsonwebtoken')
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

module.exports = { requireAuth }
