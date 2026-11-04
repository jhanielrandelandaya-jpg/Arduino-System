const express = require('express')
const { getDatabase } = require('../config/database')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const { ensureUserSettings } = require('../utils/userSettings')

const router = express.Router()

const ACTION_TITLES = {
  'class.created': 'New class added',
  'class.updated': 'Class updated',
  'class.deleted': 'Class removed',
  'quiz.created': 'New quiz added',
  'quiz.updated': 'Quiz updated',
  'quiz.due_date_updated': 'Quiz due date updated',
  'quiz.status_updated': 'Quiz status updated',
  'quiz.deleted': 'Quiz removed',
}

const rolePath = (role) => (role === 'Faculty' ? '/faculty' : '/student')

const notificationType = (action = '') => {
  if (action.startsWith('class.')) return 'class'
  if (action.startsWith('quiz.')) return 'quiz'
  return 'reminder'
}

const activityNotifications = async (userId, role, settings) => {
  const database = await getDatabase()
  const classes = await database.collection('classes').find({}).toArray()
  const accessibleIds = []
  for (const cls of classes) {
    if (role === 'Faculty') {
      if (cls.faculty_id === userId) accessibleIds.push(cls.id)
      continue
    }
    const enrollment = await database
      .collection('enrollments')
      .findOne({ class_id: cls.id, student_id: userId, status: 'Active' })
    if (enrollment && cls.status === 'Published') {
      accessibleIds.push(cls.id)
    }
  }

  const rows = await database
    .collection('activity_logs')
    .find({ class_id: { $in: accessibleIds } })
    .sort({ created_at: -1 })
    .limit(40)
    .toArray()

  return rows
    .filter((row) => {
      if (row.action.startsWith('class.') && !settings.notify_classes) {
        return false
      }

      if (row.action.startsWith('quiz.') && !settings.notify_quizzes) {
        return false
      }

      return true
    })
    .map((row) => {
      const type = notificationType(row.action)

      return {
        id: row.id,
        type,
        action: row.action,
        title: ACTION_TITLES[row.action] || 'Workspace update',
        message: row.message,
        createdAt: row.created_at,
        path:
          type === 'class'
            ? `${rolePath(role)}/subjects`
            : `${rolePath(role)}/quizzes`,
      }
    })
}

const reminderNotifications = async (userId, role, settings) => {
  if (!settings.notify_reminders) {
    return []
  }

  const database = await getDatabase()

  if (role === 'Faculty') {
    const drafts = await database
      .collection('quizzes')
      .find({ status: 'Draft' })
      .toArray()
    const ownedClassIds = (await database
      .collection('classes')
      .find({ faculty_id: userId })
      .toArray())
      .map((cls) => cls.id)

    const draftsForFaculty = drafts
      .filter((quiz) => ownedClassIds.includes(quiz.class_id))
      .sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)))
      .slice(0, 3)

    return draftsForFaculty.map((quiz) => ({
      id: `reminder-draft-${quiz.id}`,
      type: 'reminder',
      action: 'quiz.draft',
      title: 'Draft quiz waiting',
      message: `${quiz.quiz_title} is still a draft. Publish it when you are ready.`,
      createdAt: quiz.created_date,
      path: `${rolePath(role)}/quizzes`,
    }))
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setDate(end.getDate() + 7)

  const quizzes = await database
    .collection('quizzes')
    .find({})
    .toArray()
  const dueSoon = []
  for (const quiz of quizzes) {
    const cls = await database
      .collection('classes')
      .findOne({ id: quiz.class_id })
    if (!cls || cls.status !== 'Published') continue
    if (quiz.status !== 'Published') continue
    const enrollment = await database
      .collection('enrollments')
      .findOne({
        class_id: quiz.class_id,
        student_id: userId,
        status: 'Active',
      })
    if (!enrollment) continue
    if (!quiz.due_date) continue
    const due = new Date(quiz.due_date)
    if (Number.isNaN(due.getTime())) continue
    if (due >= today && due <= end) {
      dueSoon.push(quiz)
    }
  }

  return dueSoon
    .sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)))
    .slice(0, 3)
    .map((quiz) => ({
      id: `reminder-due-${quiz.id}`,
      type: 'reminder',
      action: 'quiz.due_soon',
      title: 'Quiz due soon',
      message: `${quiz.quiz_title} is due ${quiz.due_date}.`,
      createdAt: quiz.created_date,
      path: `${rolePath(role)}/quizzes`,
    }))
}

router.get('/', requireAuth, requireRole('Faculty', 'Student'), async (req, res) => {
  try {
    const settings = await ensureUserSettings(req.userId)
    const notifications = [
      ...(await activityNotifications(req.userId, req.userRole, settings)),
      ...(await reminderNotifications(req.userId, req.userRole, settings)),
    ]
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      )
      .map((item) => ({
        ...item,
        read: Boolean(settings.notifications_read_at && item.createdAt <= settings.notifications_read_at),
      }))

    return res.json({
      notifications: notifications.slice(0, 12),
      unreadCount: notifications.filter((item) => !item.read).length,
    })
  } catch (error) {
    console.error('Load notifications error:', error)
    return res
      .status(500)
      .json({ message: 'Could not load notifications. Please try again.' })
  }
})

router.post('/read', requireAuth, async (req, res) => {
  try {
    const database = await getDatabase()
    const readAt = new Date().toISOString()
    await database.collection('user_settings').updateOne(
      { user_id: req.userId },
      { $set: { notifications_read_at: readAt, updated_at: readAt } },
      { upsert: true },
    )

    return res.json({ readAt })
  } catch (error) {
    console.error('Mark notifications read error:', error)
    return res
      .status(500)
      .json({ message: 'Could not update notifications. Please try again.' })
  }
})

module.exports = router
