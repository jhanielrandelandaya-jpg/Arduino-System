const crypto = require('crypto')
const express = require('express')
const db = require('../config/database')
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

router.get('/dashboard', requireAuth, requireRole('Student'), (req, res) => {
  try {
    const classes = db.prepare(`
      ${STUDENT_CLASS_SELECT.replace(
        'SELECT c.*, u.full_name AS teacher_name,',
        `SELECT c.*,
          (SELECT COUNT(*) FROM classwork w
            LEFT JOIN submissions sub ON sub.classwork_id = w.id
              AND sub.student_id = ?
            WHERE w.class_id = c.id AND w.status = 'Published'
              AND w.type = 'assignment'
              AND (sub.status IS NULL OR sub.status IN ('assigned','returned'))
          ) AS pending_classwork,
          u.full_name AS teacher_name,`,
      )}
      JOIN enrollments e ON e.class_id = c.id
      WHERE e.student_id = ? AND e.status = 'Active' AND c.status = 'Published'
      ORDER BY c.created_date ASC
    `).all(req.userId, req.userId)
    const quizzes = db.prepare(`
      ${QUIZ_SELECT.replace(
        'SELECT q.*,',
        `SELECT q.*,
          (SELECT COUNT(*) FROM quiz_attempts qa
            WHERE qa.quiz_id = q.id AND qa.student_id = ?) AS student_attempts,
          (SELECT MAX(qa.score) FROM quiz_attempts qa
            WHERE qa.quiz_id = q.id AND qa.student_id = ?) AS student_best_score,`,
      )}
      JOIN enrollments e ON e.class_id = c.id
      WHERE e.student_id = ? AND e.status = 'Active'
        AND c.status = 'Published' AND q.status = 'Published'
      ORDER BY q.created_date DESC
    `).all(req.userId, req.userId, req.userId)
    const slides = db.prepare(`
      ${SLIDE_SELECT}
      JOIN enrollments e ON e.class_id = c.id
      WHERE e.student_id = ? AND e.status = 'Active'
        AND c.status = 'Published' AND s.status = 'Published'
      ORDER BY s.created_date ASC
    `).all(req.userId)
    const attempts = db.prepare(`
      SELECT qa.id, qa.quiz_id, qa.score, qa.passed, qa.correct_count,
        qa.question_count, qa.submitted_at, q.quiz_title, q.class_id,
        q.passing, c.subject_code, c.class_name
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      JOIN classes c ON c.id = q.class_id
      WHERE qa.student_id = ?
      ORDER BY qa.submitted_at DESC
    `).all(req.userId)
    const classwork = db.prepare(`
      SELECT w.*, c.class_name, c.subject_code, c.faculty_id,
        CASE
          WHEN sub.status IS NULL AND w.due_at IS NOT NULL
            AND datetime(w.due_at) < datetime('now') THEN 'missing'
          ELSE COALESCE(sub.status, 'assigned')
        END AS student_status,
        sub.id AS submission_id, sub.grade, sub.submitted_at,
        sub.submission_text, sub.file_id, sub.file_name, sub.file_size
      FROM classwork w
      JOIN classes c ON c.id = w.class_id
      JOIN enrollments e ON e.class_id = c.id
        AND e.student_id = ? AND e.status = 'Active'
      LEFT JOIN submissions sub ON sub.classwork_id = w.id
        AND sub.student_id = e.student_id
      WHERE c.status = 'Published' AND w.status = 'Published'
      ORDER BY w.due_at IS NULL, w.due_at, w.created_at DESC
    `).all(req.userId)

    return res.json({
      classes: classes.map(mapClass),
      quizzes: quizzes.map((quiz) => mapQuiz(quiz, { includeAnswers: false })),
      slides: slides.map(mapSlide),
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quiz_id,
        quizTitle: attempt.quiz_title,
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
      classwork: classwork.map(mapClasswork),
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Student dashboard error:', error)
    return res.status(500).json({ message: 'Could not load student dashboard.' })
  }
})

router.post('/enrollments', requireAuth, requireRole('Student'), (req, res) => {
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
    let learningClass = db.prepare(`
      SELECT id FROM classes
      WHERE UPPER(TRIM(join_code)) = UPPER(?)
        AND status = 'Published'
    `).get(joinCode)
    if (!learningClass) {
      learningClass = db.prepare(`
      SELECT id FROM classes
      WHERE UPPER(TRIM(class_code)) = UPPER(?)
        AND status = 'Published'
      `).get(joinCode)
    }
    if (!learningClass) {
      const subjectMatches = db.prepare(`
        SELECT id FROM classes
        WHERE UPPER(TRIM(subject_code)) = UPPER(?)
          AND status = 'Published'
        LIMIT 2
      `).all(joinCode)
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

    db.prepare(`
      INSERT INTO enrollments (id, student_id, class_id, status)
      VALUES (?, ?, ?, 'Active')
      ON CONFLICT(student_id, class_id)
      DO UPDATE SET status = 'Active'
    `).run(crypto.randomUUID(), req.userId, learningClass.id)

    const enrolled = db
      .prepare(`
        ${STUDENT_CLASS_SELECT}
        JOIN enrollments e ON e.class_id = c.id
        WHERE c.id = ? AND e.student_id = ? AND e.status = 'Active'
      `)
      .get(learningClass.id, req.userId)
    return res.status(201).json({ class: mapClass(enrolled) })
  } catch (error) {
    console.error('Student enrollment error:', error)
    return res.status(500).json({ message: 'Could not join this class.' })
  }
})

module.exports = router
