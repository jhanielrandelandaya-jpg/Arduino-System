const { getDatabase } = require('../config/database')

const byCreatedDate = (left, right) =>
  String(left.created_date || '').localeCompare(String(right.created_date || '')) ||
  String(left.id).localeCompare(String(right.id))

const getStudentLearningLocks = async (database, classId, studentId) => {
  const [slides, quizzes] = await Promise.all([
    database
      .collection('slides')
      .find({ class_id: classId, status: 'Published' })
      .toArray(),
    database
      .collection('quizzes')
      .find({ class_id: classId, status: 'Published' })
      .toArray(),
  ])
  const hasCompleteSlideOrder = slides.every((slide) =>
    Number.isInteger(slide.order_index),
  )
  slides.sort(
    hasCompleteSlideOrder
      ? (left, right) => left.order_index - right.order_index
      : byCreatedDate,
  )
  quizzes.sort(byCreatedDate)

  const attempts = await database
    .collection('quiz_attempts')
    .find({ student_id: studentId, quiz_id: { $in: quizzes.map((quiz) => quiz.id) } })
    .toArray()
  const passedQuizIds = new Set(
    attempts.filter((attempt) => attempt.passed).map((attempt) => attempt.quiz_id),
  )
  const quizzesBySlide = new Map(slides.map((slide) => [slide.id, []]))
  const assignedQuizIds = new Set()
  for (const quiz of quizzes) {
    if (quiz.topic_id && quizzesBySlide.has(quiz.topic_id)) {
      quizzesBySlide.get(quiz.topic_id).push(quiz)
      assignedQuizIds.add(quiz.id)
    }
  }

  const unassignedQuizzes = quizzes.filter(
    (quiz) => !assignedQuizIds.has(quiz.id),
  )
  const unassignedSlides = slides.filter(
    (slide) => quizzesBySlide.get(slide.id).length === 0,
  )
  unassignedQuizzes.forEach((quiz, index) => {
    const slide = unassignedSlides[index]
    if (slide) quizzesBySlide.get(slide.id).push(quiz)
  })

  const lockedQuizIds = new Set()
  let priorTopicsPassed = true
  const lockedSlideIds = new Set()
  for (const [index, slide] of slides.entries()) {
    if (!priorTopicsPassed) {
      for (const quiz of quizzesBySlide.get(slide.id)) {
        lockedQuizIds.add(quiz.id)
      }
    }
    if (index > 0) {
      const previousTopicQuizzes = quizzesBySlide.get(slides[index - 1].id)
      if (
        !priorTopicsPassed ||
        previousTopicQuizzes.some((quiz) => !passedQuizIds.has(quiz.id))
      ) {
        lockedSlideIds.add(slide.id)
      }
    }
    const topicQuizzes = quizzesBySlide.get(slide.id)
    if (topicQuizzes.some((quiz) => !passedQuizIds.has(quiz.id))) {
      priorTopicsPassed = false
    }
  }

  return { lockedSlideIds, lockedQuizIds }
}

const requireClassOwner = (classIdParam = 'id') => async (req, res, next) => {
  try {
    const database = await getDatabase()
    const learningClass = await database
      .collection('classes')
      .findOne({ id: req.params[classIdParam], faculty_id: req.userId })
    if (!learningClass) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    req.classId = learningClass.id
    req.classRecord = learningClass
    return next()
  } catch (error) {
    console.error('Class ownership check error:', error)
    return res.status(500).json({ message: 'Could not verify class access.' })
  }
}

const requireClassOwnerFromBody =
  (classIdField = 'classId') =>
  async (req, res, next) => {
    try {
      const classId = req.body?.[classIdField]
      if (typeof classId !== 'string' || !classId.trim()) {
        return res.status(400).json({ message: 'Choose a class for this item.' })
      }
      const database = await getDatabase()
      const learningClass = await database
        .collection('classes')
        .findOne({ id: classId, faculty_id: req.userId })
      if (!learningClass) {
        return res.status(404).json({ message: 'Class not found.' })
      }
      req.classId = learningClass.id
      req.classRecord = learningClass
      return next()
    } catch (error) {
      console.error('Class ownership check error:', error)
      return res.status(500).json({ message: 'Could not verify class access.' })
    }
  }

const requireActiveEnrollment = (classIdParam = 'id') => async (req, res, next) => {
  try {
    const database = await getDatabase()
    const enrollment = await database
      .collection('enrollments')
      .findOne({
        class_id: req.params[classIdParam],
        student_id: req.userId,
        status: 'Active',
      })
    if (!enrollment) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    const classRecord = await database
      .collection('classes')
      .findOne({ id: enrollment.class_id })
    if (!classRecord) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    req.classId = classRecord.id
    req.classRecord = classRecord
    return next()
  } catch (error) {
    console.error('Class enrollment check error:', error)
    return res.status(500).json({ message: 'Could not verify class access.' })
  }
}

const requireClassAccess = (classIdParam = 'id') => (req, res, next) => {
  const check =
    req.userRole === 'Faculty'
      ? requireClassOwner(classIdParam)
      : requireActiveEnrollment(classIdParam)
  return check(req, res, next)
}

const requireClassworkOwner = (classIdParam = 'id') => async (req, res, next) => {
  try {
    const database = await getDatabase()
    const classwork = await database.collection('classwork').findOne({ id: req.params[classIdParam] })
    if (!classwork) {
      return res.status(404).json({ message: 'Classwork not found.' })
    }
    const learningClass = await database.collection('classes').findOne({ id: classwork.class_id })
    if (!learningClass || learningClass.faculty_id !== req.userId) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    req.classId = learningClass.id
    req.classRecord = learningClass
    req.classwork = classwork
    return next()
  } catch (error) {
    console.error('Classwork ownership check error:', error)
    return res.status(500).json({ message: 'Could not verify classwork access.' })
  }
}

const requireClassworkAccess = (classIdParam = 'id') => async (req, res, next) => {
  try {
    const database = await getDatabase()
    const classwork = await database.collection('classwork').findOne({ id: req.params[classIdParam] })
    if (!classwork) {
      return res.status(404).json({ message: 'Classwork not found.' })
    }
    const learningClass = await database.collection('classes').findOne({ id: classwork.class_id })
    if (!learningClass) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    if (req.userRole === 'Faculty') {
      if (learningClass.faculty_id !== req.userId) {
        return res.status(404).json({ message: 'Classwork not found.' })
      }
      req.classId = learningClass.id
      req.classwork = classwork
      return next()
    }
    const enrolled = await database.collection('enrollments').findOne({
      class_id: learningClass.id,
      student_id: req.userId,
      status: 'Active',
    })
    if (!enrolled) {
      return res.status(404).json({ message: 'Classwork not found.' })
    }
    req.classId = learningClass.id
    req.classwork = classwork
    return next()
  } catch (error) {
    console.error('Classwork access check error:', error)
    return res.status(500).json({ message: 'Could not verify classwork access.' })
  }
}

const requireSlideOwner = (classIdParam = 'id') => async (req, res, next) => {
  try {
    const database = await getDatabase()
    const slide = await database.collection('slides').findOne({ id: req.params[classIdParam] })
    if (!slide) {
      return res.status(404).json({ message: 'Slide not found.' })
    }
    const learningClass = await database.collection('classes').findOne({ id: slide.class_id })
    if (!learningClass || learningClass.faculty_id !== req.userId) {
      return res.status(404).json({ message: 'Slide not found.' })
    }
    req.classId = learningClass.id
    req.slide = slide
    return next()
  } catch (error) {
    console.error('Slide ownership check error:', error)
    return res.status(500).json({ message: 'Could not verify slide access.' })
  }
}

const requireSlideAccess = (classIdParam = 'id') => async (req, res, next) => {
  try {
    const database = await getDatabase()
    const slide = await database.collection('slides').findOne({ id: req.params[classIdParam] })
    if (!slide) {
      return res.status(404).json({ message: 'Slide not found.' })
    }
    const learningClass = await database.collection('classes').findOne({ id: slide.class_id })
    if (!learningClass) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    const enrolled = await database.collection('enrollments').findOne({
      class_id: learningClass.id,
      student_id: req.userId,
      status: 'Active',
    })
    if (!enrolled) {
      return res.status(403).json({ message: 'You are not enrolled in this class.' })
    }
    const locks = await getStudentLearningLocks(database, learningClass.id, req.userId)
    if (locks.lockedSlideIds.has(slide.id)) {
      return res.status(403).json({
        message: 'Pass the previous topic’s quiz before opening this lesson.',
      })
    }
    req.classId = learningClass.id
    req.slide = slide
    return next()
  } catch (error) {
    console.error('Slide access check error:', error)
    return res.status(500).json({ message: 'Could not verify slide access.' })
  }
}

const requireQuizOwner = (classIdParam = 'id') => async (req, res, next) => {
  try {
    const database = await getDatabase()
    const quiz = await database.collection('quizzes').findOne({ id: req.params[classIdParam] })
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found.' })
    }
    const learningClass = await database.collection('classes').findOne({ id: quiz.class_id })
    if (!learningClass || learningClass.faculty_id !== req.userId) {
      return res.status(404).json({ message: 'Quiz not found.' })
    }
    req.classId = learningClass.id
    req.classRecord = learningClass
    req.quiz = quiz
    return next()
  } catch (error) {
    console.error('Quiz ownership check error:', error)
    return res.status(500).json({ message: 'Could not verify quiz access.' })
  }
}

const requireQuizAccess = (classIdParam = 'id') => async (req, res, next) => {
  try {
    const database = await getDatabase()
    const quiz = await database.collection('quizzes').findOne({ id: req.params[classIdParam] })
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found.' })
    }
    const learningClass = await database.collection('classes').findOne({ id: quiz.class_id })
    if (!learningClass) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    const enrolled = await database.collection('enrollments').findOne({
      class_id: learningClass.id,
      student_id: req.userId,
      status: 'Active',
    })
    if (!enrolled) {
      return res.status(403).json({ message: 'You are not enrolled in this class.' })
    }
    const locks = await getStudentLearningLocks(database, learningClass.id, req.userId)
    if (locks.lockedQuizIds.has(quiz.id)) {
      return res.status(403).json({
        message: 'Pass the previous topic’s quiz before opening this quiz.',
      })
    }
    req.classId = learningClass.id
    req.quiz = quiz
    return next()
  } catch (error) {
    console.error('Quiz access check error:', error)
    return res.status(500).json({ message: 'Could not verify quiz access.' })
  }
}

module.exports = {
  requireClassOwner,
  requireClassOwnerFromBody,
  requireActiveEnrollment,
  requireClassAccess,
  requireClassworkOwner,
  requireClassworkAccess,
  requireSlideOwner,
  requireSlideAccess,
  requireQuizOwner,
  requireQuizAccess,
  getStudentLearningLocks,
}
