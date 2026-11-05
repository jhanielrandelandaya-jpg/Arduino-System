const { getDatabase } = require('../config/database')

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
  requireActiveEnrollment,
  requireClassAccess,
  requireClassworkOwner,
  requireClassworkAccess,
  requireSlideOwner,
  requireSlideAccess,
  requireQuizOwner,
  requireQuizAccess,
}
