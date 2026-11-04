const express = require('express')
const db = require('../config/database')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

const router = express.Router()

const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&')

router.get('/', requireAuth, requireRole('Faculty', 'Student'), (req, res) => {
  const term = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (term.length < 2) return res.json({ results: [] })

  try {
    const pattern = `%${escapeLike(term)}%`
    const classScope =
      req.userRole === 'Faculty'
        ? 'c.faculty_id = ?'
        : `c.status = 'Published' AND EXISTS (
            SELECT 1 FROM enrollments e
            WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
          )`
    const quizzesScope =
      req.userRole === 'Faculty'
        ? 'c.faculty_id = ?'
        : `c.status = 'Published' AND q.status = 'Published' AND EXISTS (
            SELECT 1 FROM enrollments e
            WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
          )`
    const classes = db.prepare(`
      SELECT c.id, c.class_name, c.subject, c.subject_code, c.accent
      FROM classes c
      WHERE ${classScope}
        AND (c.class_name LIKE ? ESCAPE '\\'
          OR c.subject LIKE ? ESCAPE '\\'
          OR c.subject_code LIKE ? ESCAPE '\\')
      ORDER BY c.created_date DESC LIMIT 5
    `).all(req.userId, pattern, pattern, pattern)
    const quizzes = db.prepare(`
      SELECT q.id, q.quiz_title, q.subject_code, q.status
      FROM quizzes q
      JOIN classes c ON c.id = q.class_id
      WHERE ${quizzesScope}
        AND (q.quiz_title LIKE ? ESCAPE '\\'
          OR q.subject_code LIKE ? ESCAPE '\\')
      ORDER BY q.created_date DESC LIMIT 5
    `).all(req.userId, pattern, pattern)

    const base = req.userRole === 'Faculty' ? '/faculty' : '/student'
    const results = [
      ...classes.map((item) => ({
        type: 'class',
        id: item.id,
        title: item.class_name,
        subtitle: `${item.subject_code} · ${item.subject}`,
        icon: 'book',
        tone: item.accent || 'blue',
        path: `${base}/subjects`,
        query: item.class_name,
      })),
      ...quizzes.map((item) => ({
        type: 'quiz',
        id: item.id,
        title: item.quiz_title,
        subtitle: `${item.subject_code || 'Quiz'} · ${item.status}`,
        icon: 'quiz',
        tone: 'violet',
        path: `${base}/quizzes`,
        query: item.quiz_title,
      })),
    ]

    if (req.userRole === 'Faculty') {
      const students = db.prepare(`
        SELECT DISTINCT u.id, u.full_name, u.username
        FROM users u
        JOIN enrollments e ON e.student_id = u.id AND e.status = 'Active'
        JOIN classes c ON c.id = e.class_id
        WHERE u.role = 'Student' AND c.faculty_id = ?
          AND (u.full_name LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\')
        ORDER BY u.full_name ASC LIMIT 5
      `).all(req.userId, pattern, pattern)
      results.push(...students.map((item) => ({
        type: 'student',
        id: item.id,
        title: item.full_name,
        subtitle: `@${item.username} · Student`,
        icon: 'users',
        tone: 'amber',
        path: '/faculty/performance',
        query: item.full_name,
      })))
    }

    return res.json({ results })
  } catch (error) {
    console.error('Workspace search error:', error)
    return res
      .status(500)
      .json({ message: 'Could not search the workspace. Please try again.' })
  }
})

module.exports = router
