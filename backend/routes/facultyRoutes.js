const express = require('express')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

const router = express.Router()

router.get(
  '/overview',
  requireAuth,
  requireRole('Faculty'),
  (req, res) => {
    res.json({
      message: 'Faculty access granted.',
      role: req.userRole,
    })
  },
)

module.exports = router
