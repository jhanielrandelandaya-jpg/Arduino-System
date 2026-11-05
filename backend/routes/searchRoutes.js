const express = require('express')
const { getDatabase } = require('../config/database')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

const router = express.Router()

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

router.get('/', requireAuth, requireRole('Faculty', 'Student'), async (req, res) => {
  const term = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (term.length < 2) return res.json({ results: [] })

  try {
    const database = await getDatabase()
    const pattern = new RegExp(escapeRegex(term), 'i')

    const accessibleClassIds =
      req.userRole === 'Faculty'
        ? null
        : (
            await database
              .collection('enrollments')
              .find({ student_id: req.userId, status: 'Active' })
              .toArray()
          ).map((enrollment) => enrollment.class_id)
    const classQuery =
      req.userRole === 'Faculty'
        ? { faculty_id: req.userId }
        : {
            id: { $in: accessibleClassIds },
            status: 'Published',
          }
    const classes = await database.collection('classes').find(classQuery).toArray()
    const classesById = new Map(classes.map((cls) => [cls.id, cls]))
    const classResults = []
    for (const cls of classes) {
      const matches =
        pattern.test(cls.class_name || '') ||
        pattern.test(cls.subject || '') ||
        pattern.test(cls.subject_code || '')
      if (!matches) continue
      classResults.push({
        type: 'class',
        id: cls.id,
        title: cls.class_name,
        subtitle: `${cls.subject_code} · ${cls.subject}`,
        icon: 'book',
        tone: cls.accent || 'blue',
        path: `${req.userRole === 'Faculty' ? '/faculty' : '/student'}/subjects`,
        query: cls.class_name,
      })
    }

    const quizzes = await database.collection('quizzes').find({}).toArray()
    const quizResults = []
    for (const quiz of quizzes) {
      const cls = classesById.get(quiz.class_id)
      if (!cls) continue
      const matches = pattern.test(quiz.quiz_title || '') || pattern.test(quiz.subject_code || '')
      if (!matches) continue
      if (req.userRole === 'Student' && quiz.status !== 'Published') {
        continue
      }
      quizResults.push({
        type: 'quiz',
        id: quiz.id,
        title: quiz.quiz_title,
        subtitle: `${quiz.subject_code || 'Quiz'} · ${quiz.status}`,
        icon: 'quiz',
        tone: 'violet',
        path: `${req.userRole === 'Faculty' ? '/faculty' : '/student'}/quizzes`,
        query: quiz.quiz_title,
      })
    }

    const base = req.userRole === 'Faculty' ? '/faculty' : '/student'
    const results = [
      ...classResults.map((item) => ({ ...item, path: item.path || `${base}/subjects` })),
      ...quizResults.map((item) => ({ ...item, path: item.path || `${base}/quizzes` })),
    ]

    if (req.userRole === 'Faculty') {
      const enrollments = await database
        .collection('enrollments')
        .find({ status: 'Active' })
        .toArray()
      const studentResults = []
      for (const enrollment of enrollments) {
        const student = await database
          .collection('users')
          .findOne({ id: enrollment.student_id })
        if (!student || student.role !== 'Student') continue
        const ownedClass = await database
          .collection('classes')
          .findOne({ id: enrollment.class_id })
        if (!ownedClass || ownedClass.faculty_id !== req.userId) continue
        if (!pattern.test(student.full_name || '') && !pattern.test(student.username || '')) continue
        studentResults.push({
          type: 'student',
          id: student.id,
          title: student.full_name,
          subtitle: `@${student.username} · Student`,
          icon: 'users',
          tone: 'amber',
          path: '/faculty/performance',
          query: student.full_name,
        })
      }
      results.push(...studentResults)
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
