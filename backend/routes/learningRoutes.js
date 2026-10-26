const crypto = require('crypto')
const express = require('express')
const db = require('../config/database')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const { seedLearningData } = require('../config/seedLearningData')

const router = express.Router()

const CLASS_SELECT = `
  SELECT c.*, u.full_name AS teacher_name,
    (SELECT COUNT(*) FROM quizzes q WHERE q.class_id = c.id) AS quiz_count
  FROM classes c
  LEFT JOIN users u ON u.id = c.teacher_id
`

const QUIZ_SELECT = `
  SELECT q.*, c.class_name, u.full_name AS teacher_name
  FROM quizzes q
  LEFT JOIN classes c ON c.id = q.class_id
  LEFT JOIN users u ON u.id = q.teacher_id
`

const safeQuestions = (value) => {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const mapClass = (row) => ({
  id: row.id,
  className: row.class_name,
  name: row.class_name,
  subject: row.subject,
  subjectCode: row.subject_code,
  code: row.subject_code,
  term: row.term,
  academicYear: row.academic_year,
  description: row.description,
  classCode: row.class_code,
  status: row.status,
  accent: row.accent,
  students: row.students,
  lessons: row.lessons,
  quizzes: row.quiz_count ?? 0,
  average: row.average,
  teacherId: row.teacher_id,
  teacherName: row.teacher_name,
  createdDate: row.created_date,
  updatedAt: row.updated_at,
})

const mapQuiz = (row) => ({
  id: row.id,
  quizTitle: row.quiz_title,
  title: row.quiz_title,
  classId: row.class_id,
  subjectId: row.class_id,
  className: row.class_name,
  subjectCode: row.subject_code,
  dueDate: row.due_date,
  due: row.due_date,
  status: row.status,
  timeLimit: row.time_limit,
  maxScore: row.max_score,
  passing: row.passing,
  questions: row.questions,
  attemptsAllowed: row.attempts_allowed,
  attempts: row.attempts,
  average: row.average,
  questionList: safeQuestions(row.questions_json),
  type: 'Faculty quiz',
  teacherId: row.teacher_id,
  teacherName: row.teacher_name,
  createdDate: row.created_date,
  updatedAt: row.updated_at,
})

const mapActivity = (row) => ({
  id: row.id,
  action: row.action,
  entityType: row.entity_type,
  entityId: row.entity_id,
  message: row.message,
  actorId: row.actor_id,
  actorName: row.actor_name,
  classId: row.class_id,
  quizId: row.quiz_id,
  createdAt: row.created_at,
})

const getTeacher = (userId) =>
  db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(userId)

const recordActivity = ({
  action,
  entityType,
  entityId,
  message,
  teacher,
  classId = null,
  quizId = null,
}) => {
  db.prepare(`
    INSERT INTO activity_logs
      (id, action, entity_type, entity_id, message, actor_id, actor_name,
       class_id, quiz_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    action,
    entityType,
    entityId,
    message,
    teacher.id,
    teacher.full_name,
    classId,
    quizId,
  )
}

const createClassCode = (subjectCode) => {
  const base =
    String(subjectCode || 'CLASS')
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 10) || 'CLASS'
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5)
  return `${base}-${suffix}`
}

const classFields = (body, current = {}) => {
  const className =
    typeof body.className === 'string'
      ? body.className.trim()
      : current.class_name
  const subject =
    typeof body.subject === 'string' ? body.subject.trim() : current.subject
  const subjectCode =
    typeof body.subjectCode === 'string'
      ? body.subjectCode.trim()
      : current.subject_code

  return {
    className,
    subject,
    subjectCode,
    term:
      typeof body.term === 'string' ? body.term.trim() : current.term || '',
    academicYear:
      typeof body.academicYear === 'string'
        ? body.academicYear.trim()
        : current.academic_year || '',
    description:
      typeof body.description === 'string'
        ? body.description.trim()
        : current.description || '',
    status: ['Published', 'Draft', 'Archived'].includes(body.status)
      ? body.status
      : current.status || 'Published',
    accent:
      typeof body.accent === 'string' && body.accent.trim()
        ? body.accent.trim()
        : current.accent || 'blue',
    students: Number.isFinite(Number(body.students))
      ? Number(body.students)
      : current.students || 0,
    lessons: Number.isFinite(Number(body.lessons))
      ? Number(body.lessons)
      : current.lessons || 0,
    average: Number.isFinite(Number(body.average))
      ? Number(body.average)
      : current.average || 0,
  }
}

const quizFields = (body, current = {}) => {
  const quizTitle =
    typeof body.quizTitle === 'string'
      ? body.quizTitle.trim()
      : typeof body.title === 'string'
        ? body.title.trim()
        : current.quiz_title
  const dueDate =
    typeof body.dueDate === 'string'
      ? body.dueDate.trim()
      : typeof body.due === 'string'
        ? body.due.trim()
        : current.due_date || ''
  const questionList = Array.isArray(body.questionList)
    ? body.questionList
    : safeQuestions(current.questions_json)
  const questionCount = Number(body.questions)

  return {
    quizTitle,
    classId:
      typeof body.classId === 'string'
        ? body.classId
        : typeof body.subjectId === 'string'
          ? body.subjectId
          : current.class_id,
    dueDate,
    status: ['Published', 'Draft'].includes(body.status)
      ? body.status
      : current.status || 'Draft',
    timeLimit: Number.isFinite(Number(body.timeLimit))
      ? Number(body.timeLimit)
      : current.time_limit || 15,
    maxScore: Number.isFinite(Number(body.maxScore))
      ? Number(body.maxScore)
      : current.max_score || 100,
    passing: Number.isFinite(Number(body.passing))
      ? Number(body.passing)
      : current.passing || 75,
    questions: Number.isFinite(questionCount)
      ? questionCount
      : current.questions || questionList.length || 1,
    attemptsAllowed: Number.isFinite(Number(body.attemptsAllowed))
      ? Number(body.attemptsAllowed)
      : current.attempts_allowed || 2,
    questionList,
  }
}

router.get('/bootstrap', requireAuth, (req, res) => {
  try {
    seedLearningData(db)

    const classes = db
      .prepare(`${CLASS_SELECT} ORDER BY c.created_date ASC`)
      .all()
    const quizzes = db
      .prepare(`${QUIZ_SELECT} ORDER BY q.created_date DESC`)
      .all()
    const activity = db
      .prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 20')
      .all()

    return res.json({
      classes: classes.map(mapClass),
      quizzes: quizzes.map(mapQuiz),
      activity: activity.map(mapActivity),
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Learning bootstrap error:', error)
    return res.status(500).json({
      message: 'Could not load shared class and quiz data.',
    })
  }
})

router.get('/classes', requireAuth, (req, res) => {
  try {
    seedLearningData(db)
    const classes = db
      .prepare(`${CLASS_SELECT} ORDER BY c.created_date ASC`)
      .all()
    return res.json({ classes: classes.map(mapClass) })
  } catch (error) {
    console.error('Load classes error:', error)
    return res.status(500).json({ message: 'Could not load classes.' })
  }
})

router.post(
  '/classes',
  requireAuth,
  requireRole('Faculty'),
  (req, res) => {
    try {
      const teacher = getTeacher(req.userId)
      const fields = classFields(req.body || {})

      if (!fields.className || fields.className.length < 2) {
        return res
          .status(400)
          .json({ message: 'Enter a class name with at least 2 characters.' })
      }

      if (!fields.subject) {
        return res.status(400).json({ message: 'Enter the class subject.' })
      }

      if (!fields.subjectCode) {
        return res
          .status(400)
          .json({ message: 'Enter a subject code for this class.' })
      }

      const id = `class-${crypto.randomUUID()}`
      const classCode = createClassCode(fields.subjectCode)

      db.prepare(`
        INSERT INTO classes
          (id, class_name, subject, subject_code, term, academic_year,
           description, class_code, status, accent, students, lessons, average,
           teacher_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        fields.className,
        fields.subject,
        fields.subjectCode,
        fields.term,
        fields.academicYear,
        fields.description,
        classCode,
        fields.status,
        fields.accent,
        fields.students,
        fields.lessons,
        fields.average,
        teacher.id,
      )

      recordActivity({
        action: 'class.created',
        entityType: 'class',
        entityId: id,
        message: `Teacher ${teacher.full_name} added a new class: ${fields.className}`,
        teacher,
        classId: id,
      })

      const created = db.prepare(`${CLASS_SELECT} WHERE c.id = ?`).get(id)
      return res.status(201).json({ class: mapClass(created) })
    } catch (error) {
      console.error('Create class error:', error)
      return res.status(500).json({ message: 'Could not create the class.' })
    }
  },
)

router.patch(
  '/classes/:id',
  requireAuth,
  requireRole('Faculty'),
  (req, res) => {
    try {
      const current = db
        .prepare('SELECT * FROM classes WHERE id = ?')
        .get(req.params.id)

      if (!current) {
        return res.status(404).json({ message: 'Class not found.' })
      }

      const teacher = getTeacher(req.userId)
      const fields = classFields(req.body || {}, current)

      if (!fields.className || !fields.subject || !fields.subjectCode) {
        return res.status(400).json({
          message: 'Class name, subject, and subject code are required.',
        })
      }

      db.prepare(`
        UPDATE classes SET
          class_name = ?, subject = ?, subject_code = ?, term = ?,
          academic_year = ?, description = ?, status = ?, accent = ?,
          students = ?, lessons = ?, average = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `).run(
        fields.className,
        fields.subject,
        fields.subjectCode,
        fields.term,
        fields.academicYear,
        fields.description,
        fields.status,
        fields.accent,
        fields.students,
        fields.lessons,
        fields.average,
        current.id,
      )

      db.prepare('UPDATE quizzes SET subject_code = ? WHERE class_id = ?').run(
        fields.subjectCode,
        current.id,
      )

      recordActivity({
        action: 'class.updated',
        entityType: 'class',
        entityId: current.id,
        message: `Teacher ${teacher.full_name} updated the class: ${fields.className}`,
        teacher,
        classId: current.id,
      })

      const updated = db.prepare(`${CLASS_SELECT} WHERE c.id = ?`).get(current.id)
      return res.json({ class: mapClass(updated) })
    } catch (error) {
      console.error('Update class error:', error)
      return res.status(500).json({ message: 'Could not update the class.' })
    }
  },
)

router.delete(
  '/classes/:id',
  requireAuth,
  requireRole('Faculty'),
  (req, res) => {
    try {
      const current = db
        .prepare('SELECT * FROM classes WHERE id = ?')
        .get(req.params.id)

      if (!current) {
        return res.status(404).json({ message: 'Class not found.' })
      }

      const teacher = getTeacher(req.userId)
      db.prepare('DELETE FROM classes WHERE id = ?').run(current.id)

      recordActivity({
        action: 'class.deleted',
        entityType: 'class',
        entityId: current.id,
        message: `Teacher ${teacher.full_name} removed the class: ${current.class_name}`,
        teacher,
        classId: current.id,
      })

      return res.json({ message: 'Class removed.' })
    } catch (error) {
      console.error('Delete class error:', error)
      return res.status(500).json({ message: 'Could not delete the class.' })
    }
  },
)

router.get('/quizzes', requireAuth, (req, res) => {
  try {
    seedLearningData(db)
    const quizzes = db
      .prepare(`${QUIZ_SELECT} ORDER BY q.created_date DESC`)
      .all()
    return res.json({ quizzes: quizzes.map(mapQuiz) })
  } catch (error) {
    console.error('Load quizzes error:', error)
    return res.status(500).json({ message: 'Could not load quizzes.' })
  }
})

router.post(
  '/quizzes',
  requireAuth,
  requireRole('Faculty'),
  (req, res) => {
    try {
      const teacher = getTeacher(req.userId)
      const fields = quizFields(req.body || {})

      if (!fields.quizTitle || fields.quizTitle.length < 2) {
        return res
          .status(400)
          .json({ message: 'Enter a quiz title with at least 2 characters.' })
      }

      if (!fields.classId) {
        return res.status(400).json({ message: 'Choose a class for the quiz.' })
      }

      const learningClass = db
        .prepare('SELECT * FROM classes WHERE id = ?')
        .get(fields.classId)

      if (!learningClass) {
        return res.status(404).json({ message: 'Selected class not found.' })
      }

      const id = `quiz-${crypto.randomUUID()}`
      db.prepare(`
        INSERT INTO quizzes
          (id, quiz_title, class_id, subject_code, due_date, status, time_limit,
           max_score, passing, questions, attempts_allowed, questions_json,
           teacher_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        fields.quizTitle,
        fields.classId,
        learningClass.subject_code,
        fields.dueDate,
        fields.status,
        fields.timeLimit,
        fields.maxScore,
        fields.passing,
        fields.questions,
        fields.attemptsAllowed,
        JSON.stringify(fields.questionList),
        teacher.id,
      )

      recordActivity({
        action: 'quiz.created',
        entityType: 'quiz',
        entityId: id,
        message: `Teacher ${teacher.full_name} added a new quiz: ${fields.quizTitle}`,
        teacher,
        classId: fields.classId,
        quizId: id,
      })

      const created = db.prepare(`${QUIZ_SELECT} WHERE q.id = ?`).get(id)
      return res.status(201).json({ quiz: mapQuiz(created) })
    } catch (error) {
      console.error('Create quiz error:', error)
      return res.status(500).json({ message: 'Could not create the quiz.' })
    }
  },
)

router.patch(
  '/quizzes/:id',
  requireAuth,
  requireRole('Faculty'),
  (req, res) => {
    try {
      const current = db
        .prepare('SELECT * FROM quizzes WHERE id = ?')
        .get(req.params.id)

      if (!current) {
        return res.status(404).json({ message: 'Quiz not found.' })
      }

      const teacher = getTeacher(req.userId)
      const fields = quizFields(req.body || {}, current)

      if (!fields.quizTitle || fields.quizTitle.length < 2) {
        return res
          .status(400)
          .json({ message: 'Enter a quiz title with at least 2 characters.' })
      }

      if (!fields.classId) {
        return res.status(400).json({ message: 'Choose a class for the quiz.' })
      }

      const learningClass = db
        .prepare('SELECT * FROM classes WHERE id = ?')
        .get(fields.classId)

      if (!learningClass) {
        return res.status(404).json({ message: 'Selected class not found.' })
      }

      db.prepare(`
        UPDATE quizzes SET
          quiz_title = ?, class_id = ?, subject_code = ?, due_date = ?,
          status = ?, time_limit = ?, max_score = ?, passing = ?, questions = ?,
          attempts_allowed = ?, questions_json = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `).run(
        fields.quizTitle,
        fields.classId,
        learningClass.subject_code,
        fields.dueDate,
        fields.status,
        fields.timeLimit,
        fields.maxScore,
        fields.passing,
        fields.questions,
        fields.attemptsAllowed,
        JSON.stringify(fields.questionList),
        current.id,
      )

      let message = `Teacher ${teacher.full_name} updated the quiz: ${fields.quizTitle}`
      let action = 'quiz.updated'

      if (fields.dueDate !== current.due_date) {
        action = 'quiz.due_date_updated'
        message = `Teacher ${teacher.full_name} updated the due date for ${fields.quizTitle} to ${fields.dueDate}.`
      } else if (fields.status !== current.status) {
        action = 'quiz.status_updated'
        message = `Teacher ${teacher.full_name} set ${fields.quizTitle} to ${fields.status}.`
      }

      recordActivity({
        action,
        entityType: 'quiz',
        entityId: current.id,
        message,
        teacher,
        classId: fields.classId,
        quizId: current.id,
      })

      const updated = db.prepare(`${QUIZ_SELECT} WHERE q.id = ?`).get(current.id)
      return res.json({ quiz: mapQuiz(updated) })
    } catch (error) {
      console.error('Update quiz error:', error)
      return res.status(500).json({ message: 'Could not update the quiz.' })
    }
  },
)

router.delete(
  '/quizzes/:id',
  requireAuth,
  requireRole('Faculty'),
  (req, res) => {
    try {
      const current = db
        .prepare('SELECT * FROM quizzes WHERE id = ?')
        .get(req.params.id)

      if (!current) {
        return res.status(404).json({ message: 'Quiz not found.' })
      }

      const teacher = getTeacher(req.userId)
      db.prepare('DELETE FROM quizzes WHERE id = ?').run(current.id)

      recordActivity({
        action: 'quiz.deleted',
        entityType: 'quiz',
        entityId: current.id,
        message: `Teacher ${teacher.full_name} removed the quiz: ${current.quiz_title}`,
        teacher,
        classId: current.class_id,
        quizId: current.id,
      })

      return res.json({ message: 'Quiz removed.' })
    } catch (error) {
      console.error('Delete quiz error:', error)
      return res.status(500).json({ message: 'Could not delete the quiz.' })
    }
  },
)

router.get('/activity', requireAuth, (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)
    const activity = db
      .prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?')
      .all(limit)
    return res.json({ activity: activity.map(mapActivity) })
  } catch (error) {
    console.error('Load activity error:', error)
    return res.status(500).json({ message: 'Could not load recent updates.' })
  }
})

module.exports = router
