const crypto = require('crypto')
const express = require('express')
const { getDatabase } = require('../config/database')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const {
  QUIZ_TIME_LIMIT_MINUTES,
  PASSING_SCORE,
  MAX_QUIZ_QUESTIONS,
  scoreQuiz,
} = require('../utils/quizRules')

const router = express.Router()

const parseQuestions = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const mapQuiz = (quiz, attempts = []) => {
  const scoredAttempts = attempts.filter((attempt) => attempt.status !== 'In Progress')
  return {
    id: quiz.id,
    title: quiz.title,
    classId: quiz.class_id,
    questions: parseQuestions(quiz.questions_json),
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
}

const loadOwnedQuiz = async (database, id, studentId) =>
  database.collection('practice_quizzes').findOne({
    id,
    student_id: studentId,
  })

router.get('/', requireAuth, requireRole('Student'), async (req, res) => {
  try {
    const database = await getDatabase()
    const quizzes = await database
      .collection('practice_quizzes')
      .find({ student_id: req.userId })
      .sort({ created_at: -1 })
      .toArray()
    const rows = await Promise.all(
      quizzes.map(async (quiz) => {
        const attempts = await database
          .collection('practice_quiz_attempts')
          .find({ quiz_id: quiz.id, student_id: req.userId })
          .toArray()
        return mapQuiz(quiz, attempts)
      }),
    )
    return res.json({ practiceQuizzes: rows })
  } catch (error) {
    console.error('Load practice quizzes error:', error)
    return res.status(500).json({ message: 'Could not load practice quizzes.' })
  }
})

router.post('/', requireAuth, requireRole('Student'), async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
  const classId = typeof req.body.classId === 'string' ? req.body.classId.trim() : ''
  const questions = req.body.questions
  if (!title || title.length > 200) {
    return res.status(400).json({ message: 'Enter a quiz title of at most 200 characters.' })
  }
  if (!classId) {
    return res.status(400).json({ message: 'Choose a class for this practice quiz.' })
  }
  if (
    !Array.isArray(questions) ||
    questions.length < 1 ||
    questions.length > MAX_QUIZ_QUESTIONS
  ) {
    return res.status(400).json({
      message: `A practice quiz must contain between 1 and ${MAX_QUIZ_QUESTIONS} questions.`,
    })
  }
  const validQuestions = questions.every((question) => {
    if (
      !question ||
      typeof question.id !== 'string' ||
      typeof question.prompt !== 'string' ||
      !question.prompt.trim() ||
      typeof question.answer !== 'string' && typeof question.answer !== 'number'
    ) {
      return false
    }
    if (question.type === 'multiple_choice') {
      return (
        Array.isArray(question.options) &&
        question.options.length >= 2 &&
        question.options.every((option) => typeof option === 'string' && option.trim()) &&
        Number.isInteger(Number(question.answer)) &&
        Number(question.answer) >= 0 &&
        Number(question.answer) < question.options.length
      )
    }
    return question.type === 'short_answer' && String(question.answer).trim()
  })
  if (!validQuestions) {
    return res.status(400).json({ message: 'Check each question and its correct answer.' })
  }

  try {
    const database = await getDatabase()
    const enrollment = await database.collection('enrollments').findOne({
      class_id: classId,
      student_id: req.userId,
      status: 'Active',
    })
    if (!enrollment) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    const learningClass = await database.collection('classes').findOne({
      id: classId,
      status: 'Published',
    })
    if (!learningClass) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    const now = new Date().toISOString()
    const quiz = {
      _id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      student_id: req.userId,
      class_id: classId,
      title,
      questions_json: JSON.stringify(
        questions.map((question) => ({
          id: question.id,
          prompt: question.prompt.trim(),
          type: question.type,
          options: question.type === 'multiple_choice'
            ? question.options.map((option) => option.trim())
            : [],
          answer: question.type === 'multiple_choice'
            ? Number(question.answer)
            : String(question.answer).trim(),
        })),
      ),
      created_at: now,
      updated_at: now,
    }
    await database.collection('practice_quizzes').insertOne(quiz)
    return res.status(201).json({ practiceQuiz: mapQuiz(quiz) })
  } catch (error) {
    console.error('Create practice quiz error:', error)
    return res.status(500).json({ message: 'Could not create the practice quiz.' })
  }
})

router.delete('/:id', requireAuth, requireRole('Student'), async (req, res) => {
  try {
    const database = await getDatabase()
    const quiz = await loadOwnedQuiz(database, req.params.id, req.userId)
    if (!quiz) return res.status(404).json({ message: 'Practice quiz not found.' })
    await database.collection('practice_quiz_attempts').deleteMany({
      quiz_id: quiz.id,
      student_id: req.userId,
    })
    await database.collection('practice_quizzes').deleteOne({ _id: quiz._id })
    return res.json({ message: 'Practice quiz deleted.' })
  } catch (error) {
    console.error('Delete practice quiz error:', error)
    return res.status(500).json({ message: 'Could not delete the practice quiz.' })
  }
})

router.post('/:id/attempts/start', requireAuth, requireRole('Student'), async (req, res) => {
  try {
    const database = await getDatabase()
    const quiz = await loadOwnedQuiz(database, req.params.id, req.userId)
    if (!quiz) return res.status(404).json({ message: 'Practice quiz not found.' })
    const questions = parseQuestions(quiz.questions_json)
    const attemptsCollection = database.collection('practice_quiz_attempts')
    const attempts = await attemptsCollection
      .find({ quiz_id: quiz.id, student_id: req.userId })
      .toArray()
    if (attempts.some((attempt) => attempt.status !== 'In Progress' && attempt.passed)) {
      return res.status(409).json({ message: 'You have already passed this practice quiz.' })
    }
    const activeAttempt = attempts.find((attempt) => attempt.status === 'In Progress')
    if (activeAttempt) {
      const timedOut =
        Date.now() - Date.parse(activeAttempt.started_at) >
        QUIZ_TIME_LIMIT_MINUTES * 60 * 1000
      if (!timedOut) {
        return res.json({
          attempt: { id: activeAttempt.id, startedAt: activeAttempt.started_at },
          practiceQuiz: mapQuiz(quiz, attempts),
        })
      }
      const timeoutResult = scoreQuiz(questions, {}, true)
      await attemptsCollection.updateOne(
        { _id: activeAttempt._id, status: 'In Progress' },
        {
          $set: {
            ...timeoutResult,
            status: 'Submitted',
            question_count: questions.length,
            submitted_at: new Date().toISOString(),
            timed_out: true,
          },
        },
      )
    }
    const now = new Date().toISOString()
    const attempt = {
      _id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      quiz_id: quiz.id,
      student_id: req.userId,
      status: 'In Progress',
      started_at: now,
    }
    await attemptsCollection.insertOne(attempt)
    return res.status(201).json({
      attempt: { id: attempt.id, startedAt: now },
      practiceQuiz: mapQuiz(quiz, [...attempts, attempt]),
    })
  } catch (error) {
    console.error('Start practice quiz attempt error:', error)
    return res.status(500).json({ message: 'Could not start the practice quiz.' })
  }
})

router.post('/:id/attempts', requireAuth, requireRole('Student'), async (req, res) => {
  const attemptId = typeof req.body.attemptId === 'string' ? req.body.attemptId : ''
  const answers = req.body.answers
  if (!attemptId || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return res.status(400).json({ message: 'Submit an active attempt and its answers.' })
  }
  try {
    const database = await getDatabase()
    const quiz = await loadOwnedQuiz(database, req.params.id, req.userId)
    if (!quiz) return res.status(404).json({ message: 'Practice quiz not found.' })
    const attempt = await database.collection('practice_quiz_attempts').findOne({
      id: attemptId,
      quiz_id: quiz.id,
      student_id: req.userId,
      status: 'In Progress',
    })
    if (!attempt) return res.status(409).json({ message: 'This practice attempt is no longer active.' })
    const questions = parseQuestions(quiz.questions_json)
    const timedOut =
      Date.now() - Date.parse(attempt.started_at) > QUIZ_TIME_LIMIT_MINUTES * 60 * 1000
    const result = scoreQuiz(questions, answers, timedOut)
    const submittedAt = new Date().toISOString()
    await database.collection('practice_quiz_attempts').updateOne(
      { _id: attempt._id, status: 'In Progress' },
      {
        $set: {
          ...result,
          status: 'Submitted',
          question_count: questions.length,
          answers_json: JSON.stringify(answers),
          submitted_at: submittedAt,
          timed_out: timedOut,
        },
      },
    )
    return res.json({
      ...result,
      questionCount: questions.length,
      passing: PASSING_SCORE,
      timedOut,
      submittedAt,
    })
  } catch (error) {
    console.error('Submit practice quiz attempt error:', error)
    return res.status(500).json({ message: 'Could not submit the practice quiz.' })
  }
})

module.exports = router
