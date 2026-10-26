const crypto = require('crypto')

const SEEDED_KEY = 'learning_seeded_v1'

const seedClasses = [
  {
    id: 'cs-101',
    className: 'Introduction to Computing',
    subject: 'Computer Science',
    subjectCode: 'CS 101',
    term: 'First Semester',
    academicYear: '2026–2027',
    description:
      'Core computing concepts, number systems, and structured problem solving.',
    classCode: 'CS101-V9PYR',
    status: 'Published',
    accent: 'blue',
    students: 42,
    lessons: 12,
    average: 86,
  },
  {
    id: 'math-201',
    className: 'Discrete Mathematics',
    subject: 'Mathematics',
    subjectCode: 'MATH 201',
    term: 'First Semester',
    academicYear: '2026–2027',
    description:
      'Logic, sets, relations, counting techniques, and the foundations of graph theory.',
    classCode: 'MATH201-K4M2X',
    status: 'Published',
    accent: 'violet',
    students: 38,
    lessons: 16,
    average: 78,
  },
  {
    id: 'it-210',
    className: 'Web Systems & Technologies',
    subject: 'Information Technology',
    subjectCode: 'IT 210',
    term: 'First Semester',
    academicYear: '2026–2027',
    description:
      'Modern web architecture, responsive interfaces, and secure client-server systems.',
    classCode: 'IT210-7QW3L',
    status: 'Published',
    accent: 'teal',
    students: 35,
    lessons: 12,
    average: 83,
  },
  {
    id: 'eng-105',
    className: 'Technical Communication',
    subject: 'English',
    subjectCode: 'ENG 105',
    term: 'Second Semester',
    academicYear: '2025–2026',
    description:
      'Clear, professional written and oral communication for technical fields.',
    classCode: 'ENG105-8ZN6P',
    status: 'Archived',
    accent: 'amber',
    students: 29,
    lessons: 8,
    average: 90,
  },
]

const seedQuizzes = [
  {
    id: 'fq-1',
    quizTitle: 'Computing Foundations Check',
    classId: 'cs-101',
    subjectCode: 'CS 101',
    dueDate: 'Oct 30, 2026',
    status: 'Published',
    timeLimit: 15,
    maxScore: 100,
    passing: 75,
    questions: 10,
    attemptsAllowed: 2,
    attempts: 38,
    average: 86,
  },
  {
    id: 'fq-2',
    quizTitle: 'Number Systems Quiz',
    classId: 'cs-101',
    subjectCode: 'CS 101',
    dueDate: 'Nov 4, 2026',
    status: 'Published',
    timeLimit: 10,
    maxScore: 50,
    passing: 80,
    questions: 8,
    attemptsAllowed: 2,
    attempts: 24,
    average: 79,
  },
  {
    id: 'fq-3',
    quizTitle: 'Logic & Propositions',
    classId: 'math-201',
    subjectCode: 'MATH 201',
    dueDate: 'Oct 28, 2026',
    status: 'Published',
    timeLimit: 20,
    maxScore: 40,
    passing: 75,
    questions: 12,
    attemptsAllowed: 2,
    attempts: 31,
    average: 74,
  },
  {
    id: 'fq-4',
    quizTitle: 'Client-Server Security',
    classId: 'it-210',
    subjectCode: 'IT 210',
    dueDate: 'Nov 12, 2026',
    status: 'Draft',
    timeLimit: 25,
    maxScore: 60,
    passing: 80,
    questions: 15,
    attemptsAllowed: 2,
    attempts: 0,
    average: null,
  },
]

const seedLearningData = (db) => {
  const seeded = db
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .get(SEEDED_KEY)

  if (seeded) return false

  const existing = db.prepare('SELECT COUNT(*) AS count FROM classes').get()
  if (existing.count > 0) {
    db.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)').run(
      SEEDED_KEY,
      new Date().toISOString(),
    )
    return false
  }

  const teacher = db
    .prepare(
      "SELECT id, full_name FROM users WHERE role = 'Faculty' ORDER BY created_at LIMIT 1",
    )
    .get()

  if (!teacher) return false

  const now = Date.now()

  const insertClass = db.prepare(`
    INSERT OR IGNORE INTO classes
      (id, class_name, subject, subject_code, term, academic_year, description,
       class_code, status, accent, students, lessons, average, teacher_id,
       created_date, updated_at)
    VALUES
      (@id, @className, @subject, @subjectCode, @term, @academicYear, @description,
       @classCode, @status, @accent, @students, @lessons, @average, @teacherId,
       @createdDate, @updatedAt)
  `)

  const insertQuiz = db.prepare(`
    INSERT OR IGNORE INTO quizzes
      (id, quiz_title, class_id, subject_code, due_date, status, time_limit,
       max_score, passing, questions, attempts_allowed, attempts, average,
       questions_json, teacher_id, created_date, updated_at)
    VALUES
      (@id, @quizTitle, @classId, @subjectCode, @dueDate, @status, @timeLimit,
       @maxScore, @passing, @questions, @attemptsAllowed, @attempts, @average,
       @questionsJson, @teacherId, @createdDate, @updatedAt)
  `)

  const insertActivity = db.prepare(`
    INSERT INTO activity_logs
      (id, action, entity_type, entity_id, message, actor_id, actor_name,
       class_id, quiz_id, created_at)
    VALUES
      (@id, @action, @entityType, @entityId, @message, @actorId, @actorName,
       @classId, @quizId, @createdAt)
  `)

  db.transaction(() => {
    seedClasses.forEach((item, index) => {
      const createdAt = new Date(now - (9 - index) * 86400000).toISOString()
      insertClass.run({
        ...item,
        teacherId: teacher.id,
        createdDate: createdAt,
        updatedAt: createdAt,
      })
      insertActivity.run({
        id: crypto.randomUUID(),
        action: 'class.created',
        entityType: 'class',
        entityId: item.id,
        message: `Teacher ${teacher.full_name} added a new class: ${item.className}`,
        actorId: teacher.id,
        actorName: teacher.full_name,
        classId: item.id,
        quizId: null,
        createdAt,
      })
    })

    seedQuizzes.forEach((item, index) => {
      const createdAt = new Date(now - (5 - index) * 86400000).toISOString()
      insertQuiz.run({
        ...item,
        questionsJson: '[]',
        teacherId: teacher.id,
        createdDate: createdAt,
        updatedAt: createdAt,
      })
      insertActivity.run({
        id: crypto.randomUUID(),
        action: 'quiz.created',
        entityType: 'quiz',
        entityId: item.id,
        message: `Teacher ${teacher.full_name} added a new quiz: ${item.quizTitle}`,
        actorId: teacher.id,
        actorName: teacher.full_name,
        classId: item.classId,
        quizId: item.id,
        createdAt,
      })
    })

    db.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)').run(
      SEEDED_KEY,
      new Date().toISOString(),
    )
  })()

  return true
}

module.exports = { seedLearningData }
