const express = require('express')
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  getSettings,
  updateSettings,
} = require('../controllers/authController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', requireAuth, getMe)
router.patch('/profile', requireAuth, updateProfile)
router.patch('/password', requireAuth, changePassword)
router.get('/settings', requireAuth, getSettings)
router.put('/settings', requireAuth, updateSettings)

module.exports = router
