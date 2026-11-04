const express = require('express')
const db = require('../config/database')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const { requireClassOwner } = require('../middleware/classAccessMiddleware')
const {
  CLASS_SELECT,
  QUIZ_SELECT,
  SLIDE_SELECT,
  CLASSWORK_SELECT,
  mapClass,
  mapQuiz,
  mapSlide,
  mapClasswork,
  mapActivity,
} = require('../utils/learningData')

const router = express.Router()

router.get('/overview', requireAuth, requireRole('Faculty'), (req, res) => {
  res.json({ message: 'Faculty access granted.', role: req.userRole })
})

router.get('/dashboard', requireAuth, requireRole('Faculty'), (req, res) => {
  try {
    const classes = db
      .prepare(`${CLASS_SELECT} WHERE c.faculty_id = ? ORDER BY c.created_date ASC`)
      .all(req.userId)
    const quizzes = db
      .prepare(`${QUIZ_SELECT} WHERE c.faculty_id = ? ORDER BY q.created_date DESC`)
      .all(req.userId)
    const slides = db
      .prepare(`${SLIDE_SELECT} WHERE c.faculty_id = ? ORDER BY s.created_date ASC`)
      .all(req.userId)
    const classwork = db.prepare(`
      ${CLASSWORK_SELECT}
      WHERE c.faculty_id = ?
      ORDER BY w.due_at IS NULL, w.due_at, w.created_at DESC
    `).all(req.userId)
    const enrolledRows = db.prepare(`
      SELECT u.id, u.full_name, u.username, c.id AS class_id,
        c.class_name, c.subject_code
      FROM users u
      JOIN enrollments e ON e.student_id = u.id AND e.status = 'Active'
      JOIN classes c ON c.id = e.class_id
      WHERE u.role = 'Student' AND c.faculty_id = ?
      ORDER BY u.full_name, c.class_name
    `).all(req.userId)
    const studentsById = new Map()
    enrolledRows.forEach((row) => {
      if (!studentsById.has(row.id)) {
        studentsById.set(row.id, {
          id: row.id,
          name: row.full_name,
          username: row.username,
          classIds: [],
          classNames: [],
          subjectCodes: [],
        })
      }
      const student = studentsById.get(row.id)
      student.classIds.push(row.class_id)
      student.classNames.push(row.class_name)
      student.subjectCodes.push(row.subject_code)
    })
    const activity = db.prepare(`
      SELECT a.* FROM activity_logs a
      JOIN classes c ON c.id = a.class_id
      WHERE c.faculty_id = ?
      ORDER BY a.created_at DESC LIMIT 20
    `).all(req.userId)

    return res.json({
      classes: classes.map(mapClass),
      quizzes: quizzes.map(mapQuiz),
      slides: slides.map(mapSlide),
      classwork: classwork.map(mapClasswork),
      students: [...studentsById.values()],
      activity: activity.map(mapActivity),
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Faculty dashboard error:', error)
    return res.status(500).json({ message: 'Could not load faculty dashboard.' })
  }
})

router.get(
  '/classes/:id/students',
  requireAuth,
  requireRole('Faculty'),
  requireClassOwner('id'),
  (req, res) => {
    try {
      const students = db.prepare(`
        SELECT u.id, u.full_name AS name, u.username, e.enrolled_at AS enrolledAt
        FROM enrollments e
        JOIN users u ON u.id = e.student_id
        WHERE e.class_id = ? AND e.status = 'Active' AND u.role = 'Student'
        ORDER BY u.full_name
      `).all(req.classId)
      return res.json({ students })
    } catch (error) {
      console.error('Load class students error:', error)
      return res.status(500).json({ message: 'Could not load class students.' })
    }
  },
)

router.get(
  '/classes/:id/quiz-attempts',
  requireAuth,
  requireRole('Faculty'),
  requireClassOwner('id'),
  (req, res) => {
    try {
      const attempts = db.prepare(`
        SELECT qa.id, qa.quiz_id AS quizId, qa.student_id AS studentId,
          qa.score, qa.passed, qa.correct_count AS correctCount,
          qa.question_count AS questionCount, qa.submitted_at AS submittedAt,
          q.quiz_title AS quizTitle, q.passing, u.full_name AS studentName,
          u.username, c.class_name AS className
        FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
        JOIN classes c ON c.id = q.class_id
        JOIN users u ON u.id = qa.student_id AND u.role = 'Student'
        JOIN enrollments e ON e.student_id = qa.student_id
          AND e.class_id = c.id AND e.status = 'Active'
        WHERE c.id = ? AND c.faculty_id = ?
        ORDER BY qa.submitted_at DESC
      `).all(req.classId, req.userId)
      return res.json({ attempts })
    } catch (error) {
      console.error('Load class quiz attempts error:', error)
      return res.status(500).json({ message: 'Could not load quiz scores.' })
    }
  },
)

module.exports = router
