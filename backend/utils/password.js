const crypto = require('crypto')

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const verifyPassword = (password, storedHash) => {
  const [salt, hash] = (storedHash || '').split(':')

  if (!salt || !hash) {
    return false
  }

  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')

  if (candidate.length !== expected.length) {
    return false
  }

  return crypto.timingSafeEqual(candidate, expected)
}

module.exports = { hashPassword, verifyPassword }
