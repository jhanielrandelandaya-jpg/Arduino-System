const jwtSecret =
  process.env.JWT_SECRET || 'learnspace-dev-secret-change-me'

if (!process.env.JWT_SECRET) {
  console.warn(
    'JWT_SECRET is not set. Using a development secret. Add JWT_SECRET to your .env file before deploying.',
  )
}

module.exports = {
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
}
