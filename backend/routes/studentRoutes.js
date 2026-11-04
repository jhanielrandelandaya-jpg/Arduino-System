const crypto = require('crypto')
const express = require('express')
const { getDatabase } = require('../config/database')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const {
  STUDENT_CLASS_SELECT,
  QUIZ_SELECT,
  SLIDE_SELECT,
  mapClass,
  mapQuiz,
  mapSlide,
  mapClasswork,
} = require('../utils/learningData')

const router = express.Router()

router.get('/dashboard', requireAuth, requireRole('Student'), async (req, res) => {
  try {
    const database = await getDatabase()
    const enrollments = await database
      .collection('enrollments')
      .find({ student_id: req.userId, status: 'Active' })
      .toArray()
    const classIds = enrollments.map((enrollment) => enrollment.class_id)

    const classes = await database
      .collection('classes')
      .find({
        id: { $in: classIds },
        status: 'Published',
      })
      .sort({ created_date: 1 })
      .toArray()
    const ownedClasses = classes.filter((cls) => classIds.includes(cls.id))

    const slides = await database
      .collection('slides')
      .find({
        class_id: { $in: ownedClasses.map((cls) => cls.id) },
        status: 'Published',
      })
      .toArray()
    const quizzes = await database
      .collection('quizzes')
      .find({
        class_id: { $in: ownedClasses.map((cls) => cls.id) },
        status: 'Published',
      })
      .toArray()
    const classworkDocs = await database
      .collection('classwork')
      .find({
        class_id: { $in: ownedClasses.map((cls) => cls.id) },
        status: 'Published',
      })
      .toArray()

    const teachers = await database
      .collection('users')
      .find({ id: { $in: ownedClasses.map((cls) => cls.faculty_id) } })
      .toArray()
    const teacherNames = new Map(
      teachers.map((teacher) => [teacher.id, teacher.full_name]),
    )

    const classRows = ownedClasses.map(async (cls) => {
      const classAssignments = classworkDocs.filter(
        (work) => work.class_id === cls.id && work.type === 'assignment',
      )
      let pendingClasswork = 0
      for (const work of classAssignments) {
        const submission = await database
          .collection('submissions')
          .findOne({ classwork_id: work.id, student_id: req.userId })
        const notSubmitted =
          !submission ||
          submission.status === undefined ||
          ['assigned', 'returned'].includes(submission.status)
        if (notSubmitted) pendingClasswork += 1
      }
      const classAttempts = quizzes
        .filter((quiz) => quiz.class_id === cls.id)
        .map((quiz) => quiz.id)
      const attempts = await database
        .collection('quiz_attempts')
        .find({ student_id: req.userId })
        .toArray()
      const classQuizAttempts = attempts.filter((attempt) =>
        classAttempts.includes(attempt.quiz_id),
      )
      return {
        ...cls,
        teacher_name: teacherNames.get(cls.faculty_id) || '',
        students: 0,
        lessons: slides.filter((slide) => slide.class_id === cls.id).length,
        quizzes: quizzes.filter((quiz) => quiz.class_id === cls.id).length,
        classwork: classworkDocs.filter((work) => work.class_id === cls.id).length,
        pending_classwork: pendingClasswork,
        average: null,
      }
    })

    const quizRows = await Promise.all(
      quizzes.map(async (quiz) => {
        const quizAttempts = await database
          .collection('quiz_attempts')
          .find({
            quiz_id: quiz.id,
            student_id: req.userId,
          })
          .toArray()
        const studentBestScore = quizAttempts.reduce(
          (best, attempt) => Math.max(best || 0, attempt.score || 0),
          0,
        )
        const classRecord = ownedClasses.find((cls) => cls.id === quiz.class_id)
        return {
          ...quiz,
          class_name: classRecord && classRecord.class_name,
          faculty_id: classRecord && classRecord.faculty_id,
          teacher_name: classRecord && teacherNames.get(classRecord.faculty_id),
          student_attempts: quizAttempts.length,
          student_best_score: studentBestScore || null,
        }
      }),
    )

    const slideRows = slides.map((slide) => {
      const classRecord = ownedClasses.find((cls) => cls.id === slide.class_id)
      return {
        ...slide,
        class_name: classRecord && classRecord.class_name,
        subject_code: classRecord && classRecord.subject_code,
        faculty_id: classRecord && classRecord.faculty_id,
      }
    })

    const classworkRows = []
    for (const work of classworkDocs) {
      const submission = await database
        .collection('submissions')
        .findOne({ classwork_id: work.id, student_id: req.userId })
      const classRecord = ownedClasses.find((cls) => cls.id === work.class_id)
      classworkRows.push({
        ...work,
        class_name: classRecord && classRecord.class_name,
        subject_code: classRecord && classRecord.subject_code,
        faculty_id: classRecord && classRecord.faculty_id,
        student_status:
          submission && submission.status
            ? submission.status
            : work.type === 'assignment'
              ? 'assigned'
              : work.status,
        submission_id: submission ? submission.id : null,
        grade: submission ? submission.grade ?? null : null,
        submitted_at: submission ? submission.submitted_at ?? null : null,
        submission_text: submission ? submission.submission_text || '' : '',
        file_id: submission ? submission.file_id ?? null : null,
        file_name: submission ? submission.file_name ?? null : null,
        file_size: submission ? submission.file_size ?? null : null,
      })
    }

    const attempts = await database
      .collection('quiz_attempts')
      .find({ student_id: req.userId })
      .toArray()

    return res.json({
      classes: classRows.map(mapClass),
      quizzes: quizRows.map((quiz) => mapQuiz(quiz, { includeAnswers: false })),
      slides: slideRows.map(mapSlide),
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quiz_id,
        quizTitle: attempt.quiz_id,
        classId: attempt.class_id,
        className: attempt.class_name,
        subjectCode: attempt.subject_code,
        score: attempt.score,
        passed: Boolean(attempt.passed),
        correctCount: attempt.correct_count,
        questionCount: attempt.question_count,
        passing: attempt.passing,
        submittedAt: attempt.submitted_at,
      })),
      classwork: classworkRows.map(mapClasswork),
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Student dashboard error:', error)
    return res.status(500).json({ message: 'Could not load student dashboard.' })
  }
})

router.post('/enrollments', requireAuth, requireRole('Student'), async (req, res) => {
  const joinCode =
    typeof req.body?.joinCode === 'string'
      ? req.body.joinCode.trim()
      : typeof req.body?.classCode === 'string'
        ? req.body.classCode.trim()
        : ''
  if (!joinCode) {
    return res.status(400).json({ message: 'Enter a class code.' })
  }

  try {
    const database = await getDatabase()
    const classes = await database
      .collection('classes')
      .find({ status: 'Published' })
      .toArray()
    let learningClass = await database
      .collection('classes')
      .findOne({
        $or: [{ join_code: joinCode }, { class_code: joinCode }],
      })
    if (!learningClass) {
      const subjectMatches = await database
        .collection('classes')
        .find({ status: 'Published', subject_code: joinCode })
        .toArray()
      if (subjectMatches.length > 1) {
        return res.status(409).json({
          message: 'This subject code matches multiple classes. Use the unique class code shown by your faculty.',
        })
      }
      learningClass = subjectMatches[0]
    }
    if (!learningClass) {
      return res.status(404).json({
        message: 'Class code not found. Use the class code shown by your faculty.',
      })
    }

    const existing = await database
      .collection('enrollments')
      .findOne({ student_id: req.userId, class_id: learningClass.id })
    if (existing) {
      await database.collection('enrollments').updateOne(
        { student_id: req.userId, class_id: learningClass.id },
        { $set: { status: 'Active' } },
      )
    } else {
      const enrollmentId = crypto.randomUUID()
      await database.collection('enrollments').insertOne({
        _id: enrollmentId,
        id: enrollmentId,
        student_id: req.userId,
        class_id: learningClass.id,
        status: 'Active',
        enrolled_at: new Date().toISOString(),
      })
    }

    const enrolled = await database
      .collection('classes')
      .findOne({ id: learningClass.id, status: 'Published' })
    return res.status(201).json({ class: mapClass(enrolled) })
  } catch (error) {
    console.error('Student enrollment error:', error)
    return res.status(500).json({ message: 'Could not join this class.' })
  }
})

module.exports = router

