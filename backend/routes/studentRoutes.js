const crypto = require('crypto')
const express = require('express')
const { getDatabase } = require('../config/database')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const { getStudentLearningLocks } = require('../middleware/classAccessMiddleware')
const {
  QUIZ_TIME_LIMIT_MINUTES,
  PASSING_SCORE,
} = require('../utils/quizRules')
const {
  STUDENT_CLASS_SELECT,
  QUIZ_SELECT,
  SLIDE_SELECT,
  safeJsonArray,
  mapClass,
  mapQuiz,
  mapSlide,
  mapClasswork,
} = require('../utils/learningData')

const router = express.Router()

const getAccessibleStudentSlide = async (database, slideId, studentId) => {
  const slide = await database.collection('slides').findOne({
    id: slideId,
    status: 'Published',
  })
  if (!slide) return null
  const learningClass = await database.collection('classes').findOne({
    id: slide.class_id,
    status: 'Published',
  })
  if (!learningClass) return null
  const enrollment = await database.collection('enrollments').findOne({
    class_id: learningClass.id,
    student_id: studentId,
    status: 'Active',
  })
  return enrollment ? { slide, learningClass } : null
}

router.get('/notes', requireAuth, requireRole('Student'), async (req, res) => {
  try {
    const database = await getDatabase()
    const notes = await database
      .collection('student_notes')
      .find({ student_id: req.userId })
      .sort({ updated_at: -1 })
      .toArray()
    const accessibleNotes = []
    for (const note of notes) {
      const access = await getAccessibleStudentSlide(
        database,
        note.topic_id,
        req.userId,
      )
      if (!access) continue
      accessibleNotes.push({
        id: note.id,
        topicId: note.topic_id,
        title: note.title,
        body: note.body,
        updatedAt: note.updated_at,
      })
    }
    return res.json({ notes: accessibleNotes })
  } catch (error) {
    console.error('Load student notes error:', error)
    return res.status(500).json({ message: 'Could not load your notes.' })
  }
})

router.post('/notes', requireAuth, requireRole('Student'), async (req, res) => {
  const topicId =
    typeof req.body.topicId === 'string' ? req.body.topicId.trim() : ''
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
  const body = typeof req.body.body === 'string' ? req.body.body : ''
  if (!topicId || title.length > 200 || body.length > 50000) {
    return res.status(400).json({ message: 'Check the topic, note title, and note length.' })
  }
  try {
    const database = await getDatabase()
    const access = await getAccessibleStudentSlide(
      database,
      topicId,
      req.userId,
    )
    if (!access) return res.status(404).json({ message: 'Lesson not found.' })
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const note = {
      _id: id,
      id,
      student_id: req.userId,
      topic_id: topicId,
      title: title || 'Untitled note',
      body,
      created_at: now,
      updated_at: now,
    }
    await database.collection('student_notes').insertOne(note)
    return res.status(201).json({
      note: {
        id,
        topicId,
        title: note.title,
        body,
        updatedAt: now,
      },
    })
  } catch (error) {
    console.error('Create student note error:', error)
    return res.status(500).json({ message: 'Could not create your note.' })
  }
})

router.patch(
  '/notes/:id',
  requireAuth,
  requireRole('Student'),
  async (req, res) => {
    const updates = {}
    if (typeof req.body.title === 'string') {
      const title = req.body.title.trim()
      if (title.length > 200) {
        return res.status(400).json({ message: 'Note titles must be 200 characters or fewer.' })
      }
      updates.title = title || 'Untitled note'
    }
    if (typeof req.body.body === 'string') {
      if (req.body.body.length > 50000) {
        return res.status(400).json({ message: 'Notes must be 50,000 characters or fewer.' })
      }
      updates.body = req.body.body
    }
    if (typeof req.body.topicId === 'string') {
      updates.topic_id = req.body.topicId.trim()
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Provide a note field to update.' })
    }
    try {
      const database = await getDatabase()
      const note = await database.collection('student_notes').findOne({
        id: req.params.id,
        student_id: req.userId,
      })
      if (!note) return res.status(404).json({ message: 'Note not found.' })
      const targetTopic = updates.topic_id || note.topic_id
      const access = await getAccessibleStudentSlide(
        database,
        targetTopic,
        req.userId,
      )
      if (!access) return res.status(404).json({ message: 'Lesson not found.' })
      const updatedAt = new Date().toISOString()
      await database.collection('student_notes').updateOne(
        { _id: note._id, student_id: req.userId },
        { $set: { ...updates, updated_at: updatedAt } },
      )
      return res.json({
        note: {
          id: note.id,
          topicId: targetTopic,
          title: updates.title ?? note.title,
          body: updates.body ?? note.body,
          updatedAt,
        },
      })
    } catch (error) {
      console.error('Update student note error:', error)
      return res.status(500).json({ message: 'Could not update your note.' })
    }
  },
)

router.delete(
  '/notes/:id',
  requireAuth,
  requireRole('Student'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const result = await database.collection('student_notes').deleteOne({
        id: req.params.id,
        student_id: req.userId,
      })
      if (!result.deletedCount) {
        return res.status(404).json({ message: 'Note not found.' })
      }
      return res.json({ message: 'Note deleted.' })
    } catch (error) {
      console.error('Delete student note error:', error)
      return res.status(500).json({ message: 'Could not delete your note.' })
    }
  },
)

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
    const learningLocks = new Map()
    for (const classId of classIds) {
      learningLocks.set(
        classId,
        await getStudentLearningLocks(database, classId, req.userId),
      )
    }
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

    const classRows = await Promise.all(
      ownedClasses.map(async (cls) => {
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
          quiz_count: quizzes.filter((quiz) => quiz.class_id === cls.id).length,
          classwork_count: classworkDocs.filter((work) => work.class_id === cls.id).length,
          pending_classwork: pendingClasswork,
          average: null,
        }
      }),
    )

    const quizRows = await Promise.all(
      quizzes.map(async (quiz) => {
        const quizAttempts = await database
          .collection('quiz_attempts')
          .find({
            quiz_id: quiz.id,
            student_id: req.userId,
            status: { $ne: 'In Progress' },
          })
          .toArray()
        const studentBestScore = quizAttempts.reduce(
          (best, attempt) => Math.max(best || 0, attempt.score || 0),
          0,
        )
        const studentPassed = quizAttempts.some((attempt) => attempt.passed)
        const classRecord = ownedClasses.find((cls) => cls.id === quiz.class_id)
        return {
          ...quiz,
          time_limit: 10,
          time_limit_minutes: 10,
          passing: 75,
          questions: safeJsonArray(quiz.questions_json).length,
          class_name: classRecord && classRecord.class_name,
          faculty_id: classRecord && classRecord.faculty_id,
          teacher_name: classRecord && teacherNames.get(classRecord.faculty_id),
          student_attempts: quizAttempts.length,
          student_best_score: studentBestScore || null,
          student_passed: studentPassed,
          student_locked: learningLocks.get(quiz.class_id)?.lockedQuizIds.has(quiz.id) || false,
        }
      }),
    )

    const slideRows = slides.map((slide) => {
      const classRecord = ownedClasses.find((cls) => cls.id === slide.class_id)
      return {
        ...slide,
        content_json: learningLocks.get(slide.class_id)?.lockedSlideIds.has(slide.id)
          ? '[]'
          : slide.content_json,
        locked: learningLocks.get(slide.class_id)?.lockedSlideIds.has(slide.id) || false,
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
      .find({ student_id: req.userId, status: { $ne: 'In Progress' } })
      .toArray()
    const practiceQuizDocs = await database
      .collection('practice_quizzes')
      .find({ student_id: req.userId })
      .sort({ created_at: -1 })
      .toArray()
    const practiceQuizRows = await Promise.all(
      practiceQuizDocs.map(async (quiz) => {
        const practiceAttempts = await database
          .collection('practice_quiz_attempts')
          .find({ quiz_id: quiz.id, student_id: req.userId })
          .toArray()
        const scoredAttempts = practiceAttempts.filter(
          (attempt) => attempt.status !== 'In Progress',
        )
        return {
          id: quiz.id,
          title: quiz.title,
          classId: quiz.class_id,
          questions: safeJsonArray(quiz.questions_json),
          createdAt: quiz.created_at,
          timeLimitMinutes: QUIZ_TIME_LIMIT_MINUTES,
          passingScore: PASSING_SCORE,
          attempts: scoredAttempts.map((attempt) => ({
            id: attempt.id,
            score: attempt.score,
            passed: attempt.passed,
            correctCount: attempt.correct_count,
            questionCount: attempt.question_count,
            submittedAt: attempt.submitted_at,
          })),
          passed: scoredAttempts.some((attempt) => attempt.passed),
          bestScore: scoredAttempts.reduce(
            (best, attempt) => Math.max(best, attempt.score || 0),
            0,
          ),
        }
      }),
    )

    return res.json({
      classes: classRows.map(mapClass),
      quizzes: quizRows.map((quiz) => mapQuiz(quiz, { includeAnswers: false })),
      slides: slideRows.map(mapSlide),
      attempts: attempts.map((attempt) => {
        const quiz = quizzes.find((item) => item.id === attempt.quiz_id)
        const classRecord = ownedClasses.find((item) => item.id === attempt.class_id)
        return {
        id: attempt.id,
        quizId: attempt.quiz_id,
        quizTitle: quiz?.quiz_title || quiz?.title || 'Quiz',
        classId: attempt.class_id,
        className: classRecord?.class_name,
        subjectCode: classRecord?.subject_code,
        score: attempt.score,
        passed: Boolean(attempt.passed),
        correctCount: attempt.correct_count,
        questionCount: attempt.question_count,
        passing: 75,
        submittedAt: attempt.submitted_at,
        studentId: attempt.student_id,
      }}),
      classwork: classworkRows.map(mapClasswork),
      practiceQuizzes: practiceQuizRows,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Student dashboard error:', error)
    return res.status(500).json({ message: 'Could not load student dashboard.' })
  }
})

router.post('/enrollments', requireAuth, requireRole('Student'), async (req, res) => {
  const joinCode = (
    typeof req.body?.joinCode === 'string'
      ? req.body.joinCode.trim()
      : typeof req.body?.classCode === 'string'
        ? req.body.classCode.trim()
        : ''
  ).toUpperCase()
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
