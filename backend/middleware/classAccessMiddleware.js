const db = require('../config/database')

const requireClassOwner = (classIdParam = 'id') => (req, res, next) => {
  try {
    const learningClass = db
      .prepare('SELECT id FROM classes WHERE id = ? AND faculty_id = ?')
      .get(req.params[classIdParam], req.userId)
    if (!learningClass) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    req.classId = learningClass.id
    return next()
  } catch (error) {
    console.error('Class ownership check error:', error)
    return res.status(500).json({ message: 'Could not verify class access.' })
  }
}

const requireActiveEnrollment = (classIdParam = 'id') => (req, res, next) => {
  try {
    const enrollment = db
      .prepare(`
        SELECT c.id FROM classes c
        JOIN enrollments e ON e.class_id = c.id
        WHERE c.id = ? AND e.student_id = ? AND e.status = 'Active'
      `)
      .get(req.params[classIdParam], req.userId)
    if (!enrollment) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    req.classId = enrollment.id
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

module.exports = {
  requireClassOwner,
  requireActiveEnrollment,
  requireClassAccess,
}
