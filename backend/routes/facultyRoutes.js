const express = require('express')
const { getDatabase } = require('../config/database')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const { requireClassOwner } = require('../middleware/classAccessMiddleware')
const { mapClass, mapQuiz, mapSlide, mapClasswork, mapActivity } = require('../utils/learningData')

const router = express.Router()

router.get('/overview', requireAuth, requireRole('Faculty'), (req, res) => {
  res.json({ message: 'Faculty access granted.', role: req.userRole })
})

router.get('/dashboard', requireAuth, requireRole('Faculty'), async (req, res) => {
  try {
    const database = await getDatabase()
    const classes = await database
      .collection('classes')
      .find({ faculty_id: req.userId })
      .sort({ created_date: 1 })
      .toArray()
    const classIds = classes.map((cls) => cls.id)

    const enrollments = await database
      .collection('enrollments')
      .find({ status: 'Active' })
      .toArray()
    const studentsByClass = new Map()
    for (const enrollment of enrollments) {
      const list = studentsByClass.get(enrollment.class_id) || []
      list.push(enrollment.student_id)
      studentsByClass.set(enrollment.class_id, list)
    }

    const slides = await database
      .collection('slides')
      .find({ class_id: { $in: classIds } })
      .toArray()
    const quizzes = await database
      .collection('quizzes')
      .find({ class_id: { $in: classIds } })
      .toArray()
    const classworkDocs = await database
      .collection('classwork')
      .find({ class_id: { $in: classIds }, status: 'Published' })
      .toArray()
    const attempts = await database
      .collection('quiz_attempts')
      .find({ quiz_id: { $in: quizzes.map((quiz) => quiz.id) } })
      .toArray()

    const teachers = await database
      .collection('users')
      .find({ id: { $in: classes.map((cls) => cls.faculty_id) } })
      .toArray()
    const teacherNames = new Map(
      teachers.map((teacher) => [teacher.id, teacher.full_name]),
    )

    const classRows = classes.map((cls) => {
      const classAttempts = attempts.filter(
        (attempt) =>
          quizzes.some(
            (quiz) => quiz.id === attempt.quiz_id && quiz.class_id === cls.id,
          ),
      )
      const average = classAttempts.length
        ? Math.round(
            classAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) /
              classAttempts.length,
          )
        : null
      return {
        ...cls,
        teacher_name: teacherNames.get(cls.faculty_id) || '',
        students: (studentsByClass.get(cls.id) || []).length,
        lessons: slides.filter((slide) => slide.class_id === cls.id).length,
        quizzes: quizzes.filter((quiz) => quiz.class_id === cls.id).length,
        classwork: classworkDocs.filter((work) => work.class_id === cls.id).length,
        average,
      }
    })

    const quizRows = quizzes.map((quiz) => {
      const classRecord = classes.find((cls) => cls.id === quiz.class_id)
      return {
        ...quiz,
        class_name: classRecord && classRecord.class_name,
        faculty_id: classRecord && classRecord.faculty_id,
        teacher_name: classRecord && teacherNames.get(classRecord.faculty_id),
      }
    })

    const slideRows = slides.map((slide) => {
      const classRecord = classes.find((cls) => cls.id === slide.class_id)
      return {
        ...slide,
        class_name: classRecord && classRecord.class_name,
        subject_code: classRecord && classRecord.subject_code,
        faculty_id: classRecord && classRecord.faculty_id,
      }
    })

    const classworkRows = classworkDocs.map((work) => {
      const classRecord = classes.find((cls) => cls.id === work.class_id)
      return {
        ...work,
        class_name: classRecord && classRecord.class_name,
        subject_code: classRecord && classRecord.subject_code,
        faculty_id: classRecord && classRecord.faculty_id,
      }
    })

    const enrolledRows = await database
      .collection('enrollments')
      .find({ class_id: { $in: classIds }, status: 'Active' })
      .toArray()
    const studentsById = new Map()
    for (const row of enrolledRows) {
      const student = await database
        .collection('users')
        .findOne({ id: row.student_id })
      if (!student) continue
      if (!studentsById.has(student.id)) {
        studentsById.set(student.id, {
          id: student.id,
          name: student.full_name,
          username: student.username,
          classIds: [],
          classNames: [],
          subjectCodes: [],
        })
      }
      const studentEntry = studentsById.get(student.id)
      studentEntry.classIds.push(row.class_id)
      const classRecord = classes.find((cls) => cls.id === row.class_id)
      studentEntry.classNames.push(
        classRecord && classRecord.class_name ? classRecord.class_name : '',
      )
      studentEntry.subjectCodes.push(
        classRecord && classRecord.subject_code ? classRecord.subject_code : '',
      )
    }

    const activity = await database
      .collection('activity_logs')
      .find({ class_id: { $in: classIds } })
      .sort({ created_at: -1 })
      .limit(20)
      .toArray()

    return res.json({
      classes: classRows.map(mapClass),
      quizzes: quizRows.map((quiz) => mapQuiz(quiz, { includeAnswers: true })),
      slides: slideRows.map(mapSlide),
      classwork: classworkRows.map(mapClasswork),
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
  async (req, res) => {
    try {
      const database = await getDatabase()
      const enrollments = await database
        .collection('enrollments')
        .find({
          class_id: req.classId,
          status: 'Active',
        })
        .toArray()
      const studentRows = []
      for (const enrollment of enrollments) {
        const student = await database
          .collection('users')
          .findOne({ id: enrollment.student_id })
        if (!student || student.role !== 'Student') continue
        studentRows.push({
          id: student.id,
          name: student.full_name,
          username: student.username,
          enrolledAt: enrollment.enrolled_at,
        })
      }
      studentRows.sort((a, b) => a.name.localeCompare(b.name))
      return res.json({ students: studentRows })
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
  async (req, res) => {
    try {
      const database = await getDatabase()
      const quizzes = await database
        .collection('quizzes')
        .find({ class_id: req.classId })
        .toArray()
      const attempts = await database
        .collection('quiz_attempts')
        .find({ quiz_id: { $in: quizzes.map((quiz) => quiz.id) } })
        .toArray()
      const rows = []
      for (const attempt of attempts) {
        const quiz = quizzes.find((item) => item.id === attempt.quiz_id)
        if (!quiz) continue
        const student = await database
          .collection('users')
          .findOne({ id: attempt.student_id })
        const enrollment = await database
          .collection('enrollments')
          .findOne({
            class_id: quiz.class_id,
            student_id: attempt.student_id,
            status: 'Active',
          })
        if (!student || !enrollment) continue
        const classRecord = await database
          .collection('classes')
          .findOne({ id: quiz.class_id })
        rows.push({
          id: attempt.id,
          quizId: attempt.quiz_id,
          studentId: attempt.student_id,
          score: attempt.score,
          passed: attempt.passed,
          correctCount: attempt.correct_count,
          questionCount: attempt.question_count,
          submittedAt: attempt.submitted_at,
          quizTitle: quiz.quiz_title,
          passing: quiz.passing,
          studentName: student.full_name,
          username: student.username,
          className: classRecord && classRecord.class_name,
        })
      }
      rows.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
      return res.json({ attempts: rows })
    } catch (error) {
      console.error('Load class quiz attempts error:', error)
      return res.status(500).json({ message: 'Could not load quiz scores.' })
    }
  },
)

module.exports = router
