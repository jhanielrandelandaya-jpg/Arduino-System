const crypto = require('crypto')
const express = require('express')
const { getDatabase } = require('../config/database')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.post('/', requireAuth, async (req, res) => {
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
    const database = await getDatabase()
    const user = await database.collection('users').findOne({ id: req.userId })

    if (!user) {
      return res.status(401).json({ message: 'Account not found.' })
    }

    const ticketId = crypto.randomUUID()
    await database.collection('support_tickets').insertOne({
      _id: ticketId,
      id: ticketId,
      user_id: req.userId,
      subject: cleanSubject,
      message: cleanMessage,
      page: cleanPage,
      status: 'Open',
      created_at: new Date().toISOString(),
    })

    return res.status(201).json({
      message: 'Support request sent.',
      ticket: { id: ticketId, status: 'Open' },
    })
  } catch (error) {
    console.error('Support request error:', error)
    return res.status(500).json({ message: 'Could not send your message. Please try again.' })
  }
})

module.exports = router
