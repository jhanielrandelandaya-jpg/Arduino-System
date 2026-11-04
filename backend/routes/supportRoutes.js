const crypto = require('crypto')
const express = require('express')
const db = require('../config/database')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.post('/', requireAuth, (req, res) => {
  const { subject, message, page } = req.body || {}
  const cleanSubject = typeof subject === 'string' ? subject.trim() : ''
  const cleanMessage = typeof message === 'string' ? message.trim() : ''
  const cleanPage = typeof page === 'string' ? page.trim().slice(0, 160) : ''

  if (cleanSubject.length < 3) {
    return res
      .status(400)
      .json({ message: 'Enter a subject with at least 3 characters.' })
  }

  if (cleanMessage.length < 10) {
    return res
      .status(400)
      .json({ message: 'Tell us a little more so we can help (at least 10 characters).' })
  }

  try {
    const user = db
      .prepare('SELECT id FROM users WHERE id = ?')
      .get(req.userId)

    if (!user) {
      return res.status(401).json({ message: 'Account not found.' })
    }

    const ticketId = crypto.randomUUID()

    db.prepare(`
      INSERT INTO support_tickets (id, user_id, subject, message, page)
      VALUES (?, ?, ?, ?, ?)
    `).run(ticketId, req.userId, cleanSubject, cleanMessage, cleanPage)

    return res.status(201).json({
      message: 'Support request sent.',
      ticket: { id: ticketId, status: 'Open' },
    })
  } catch (error) {
    console.error('Support request error:', error)
    return res
      .status(500)
      .json({ message: 'Could not send your message. Please try again.' })
  }
})

module.exports = router
