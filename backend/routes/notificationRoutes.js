const express = require('express')
const db = require('../config/database')
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

const activityNotifications = (userId, role, settings) => {
  const scope =
    role === 'Faculty'
      ? 'c.faculty_id = ?'
      : `c.status = 'Published' AND EXISTS (
          SELECT 1 FROM enrollments e
          WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
        )`
  const rows = db.prepare(`
    SELECT a.* FROM activity_logs a
    JOIN classes c ON c.id = a.class_id
    WHERE ${scope}
    ORDER BY a.created_at DESC LIMIT 40
  `).all(userId)

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

const reminderNotifications = (userId, role, settings) => {
  if (!settings.notify_reminders) {
    return []
  }

  if (role === 'Faculty') {
    const drafts = db
      .prepare(`
        SELECT q.id, q.quiz_title, q.created_date
        FROM quizzes q
        JOIN classes c ON c.id = q.class_id
        WHERE q.status = 'Draft' AND c.faculty_id = ?
        ORDER BY q.created_date DESC
        LIMIT 3
      `)
      .all(userId)

    return drafts.map((quiz) => ({
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

  const quizzes = db
    .prepare(`
      SELECT q.id, q.quiz_title, q.due_date, q.created_date
      FROM quizzes q
      JOIN classes c ON c.id = q.class_id
      JOIN enrollments e ON e.class_id = c.id
      WHERE q.status = 'Published' AND c.status = 'Published'
        AND e.student_id = ? AND e.status = 'Active'
        AND q.due_date IS NOT NULL AND q.due_date != ''
      ORDER BY q.created_date DESC
    `)
    .all(userId)

  return quizzes
    .filter((quiz) => {
      const due = new Date(quiz.due_date)
      return !Number.isNaN(due.getTime()) && due >= today && due <= end
    })
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

router.get('/', requireAuth, requireRole('Faculty', 'Student'), (req, res) => {
  try {
    const settings = ensureUserSettings(req.userId)
    const readAt = settings.notifications_read_at
    const notifications = [
      ...activityNotifications(req.userId, req.userRole, settings),
      ...reminderNotifications(req.userId, req.userRole, settings),
    ]
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      )
      .map((item) => ({
        ...item,
        read: Boolean(readAt && item.createdAt <= readAt),
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

router.post('/read', requireAuth, (req, res) => {
  try {
    ensureUserSettings(req.userId)
    const readAt = new Date().toISOString()

    db.prepare(
      'UPDATE user_settings SET notifications_read_at = ? WHERE user_id = ?',
    ).run(readAt, req.userId)

    return res.json({ readAt })
  } catch (error) {
    console.error('Mark notifications read error:', error)
    return res
      .status(500)
      .json({ message: 'Could not update notifications. Please try again.' })
  }
})

module.exports = router
