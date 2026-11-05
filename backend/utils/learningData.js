const CLASS_SELECT = `
  SELECT c.*, u.full_name AS teacher_name,
    (SELECT COUNT(*) FROM enrollments e
      WHERE e.class_id = c.id AND e.status = 'Active') AS students,
    (SELECT COUNT(*) FROM slides s WHERE s.class_id = c.id) AS lessons,
    (SELECT COUNT(*) FROM quizzes q WHERE q.class_id = c.id) AS quiz_count
    , (SELECT COUNT(*) FROM classwork w
      WHERE w.class_id = c.id AND w.status = 'Published') AS classwork_count
    , (SELECT ROUND(AVG(qa.score)) FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id WHERE q.class_id = c.id) AS average
  FROM classes c
  JOIN users u ON u.id = c.faculty_id
`

const STUDENT_CLASS_SELECT = `
  SELECT c.*, u.full_name AS teacher_name,
    (SELECT COUNT(*) FROM enrollments e
      WHERE e.class_id = c.id AND e.status = 'Active') AS students,
    (SELECT COUNT(*) FROM slides s
      WHERE s.class_id = c.id AND s.status = 'Published') AS lessons,
    (SELECT COUNT(*) FROM quizzes q
      WHERE q.class_id = c.id AND q.status = 'Published') AS quiz_count
    , (SELECT COUNT(*) FROM classwork w
      WHERE w.class_id = c.id AND w.status = 'Published') AS classwork_count
  FROM classes c
  JOIN users u ON u.id = c.faculty_id
`

const QUIZ_SELECT = `
  SELECT q.*, c.class_name, c.faculty_id, u.full_name AS teacher_name
  FROM quizzes q
  JOIN classes c ON c.id = q.class_id
  JOIN users u ON u.id = c.faculty_id
`

const SLIDE_SELECT = `
  SELECT s.*, c.class_name, c.subject_code, c.faculty_id
  FROM slides s
  JOIN classes c ON c.id = s.class_id
`

const CLASSWORK_SELECT = `
  SELECT w.*, c.class_name, c.subject_code, c.faculty_id
  FROM classwork w
  JOIN classes c ON c.id = w.class_id
`

const safeJsonArray = (value) => {
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
  classCode: row.join_code || row.class_code,
  joinCode: row.join_code || row.class_code,
  status: row.status,
  accent: row.accent,
  students: row.students,
  lessons: row.lessons,
  quizzes: row.quiz_count ?? 0,
  classwork: row.classwork_count ?? 0,
  pendingClasswork: row.pending_classwork ?? 0,
  average: row.average ?? 0,
  teacherId: row.faculty_id,
  teacherName: row.teacher_name,
  createdDate: row.created_date,
  updatedAt: row.updated_at,
})

const mapQuiz = (row, { includeAnswers = true } = {}) => ({
  id: row.id,
  quizTitle: row.quiz_title || row.title,
  title: row.quiz_title || row.title,
  classId: row.class_id,
  subjectId: row.class_id,
  topicId: row.topic_id || null,
  className: row.class_name,
  subjectCode: row.subject_code,
  dueDate: row.due_date,
  due: row.due_date,
  status: row.status,
  timeLimit: 10,
  maxScore: row.max_score,
  passing: 75,
  questions: row.questions,
  attemptsAllowed: row.attempts_allowed ?? null,
  attempts: row.attempts ?? 0,
  attemptsUsed: row.student_attempts ?? 0,
  bestScore: row.student_best_score ?? null,
  passed: Boolean(row.student_passed),
  locked: Boolean(row.student_locked ?? row.locked),
  average: row.average,
  questions: safeJsonArray(row.questions_json).length || row.questions || 0,
  questionList: safeJsonArray(row.questions_json).map((question) => {
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      return question
    }
    if (includeAnswers) return question
    const {
      answer,
      correctAnswers,
      correct_answer,
      ...studentQuestion
    } = question
    return studentQuestion
  }),
  type: 'Faculty quiz',
  teacherId: row.faculty_id,
  teacherName: row.teacher_name,
  createdDate: row.created_date,
  updatedAt: row.updated_at,
})

const mapSlide = (row) => {
  const content = safeJsonArray(row.content_json).filter(
    (item) => item && typeof item === 'object' && !Array.isArray(item),
  )
  const presentations = safeJsonArray(row.presentation_json)
  const presentation =
    presentations.length > 0 ? presentations[presentations.length - 1] : null
  if (presentation) {
    if (content.length === 0) content.push({})
    content[0] = { ...content[0], presentation }
  }
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class_name,
    subjectCode: row.subject_code,
    title: row.title,
    orderIndex: Number.isInteger(row.order_index) ? row.order_index : null,
    content,
    status: row.status,
    locked: Boolean(row.locked),
    createdDate: row.created_date,
    updatedAt: row.updated_at,
  }
}

const mapClasswork = (row) => ({
  id: row.id,
  classId: row.class_id,
  className: row.class_name,
  subjectCode: row.subject_code,
  type: row.type,
  title: row.title,
  instructions: row.instructions,
  dueAt: row.due_at,
  status: row.student_status || row.status,
  grade: row.grade ?? null,
  submittedAt: row.submitted_at ?? null,
  quizId: row.quiz_id ?? null,
  attachments: safeJsonArray(row.attachment_json),
  submittedCount: row.submitted_count ?? 0,
  studentCount: row.student_count ?? 0,
  studentId: row.student_id ?? null,
  studentName: row.student_name ?? null,
  studentUsername: row.student_username ?? null,
  submissionId: row.submission_id ?? null,
  submissionText: row.submission_text ?? '',
  fileId: row.file_id ?? null,
  fileName: row.file_name ?? null,
  fileSize: row.file_size ?? null,
  createdAt: row.created_at,
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

module.exports = {
  CLASS_SELECT,
  STUDENT_CLASS_SELECT,
  QUIZ_SELECT,
  SLIDE_SELECT,
  CLASSWORK_SELECT,
  safeJsonArray,
  mapClass,
  mapQuiz,
  mapSlide,
  mapClasswork,
  mapActivity,
}
