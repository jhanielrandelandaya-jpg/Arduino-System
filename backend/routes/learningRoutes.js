const crypto = require('crypto')
const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const db = require('../config/database')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const {
  requireClassAccess,
  requireClassOwner,
} = require('../middleware/classAccessMiddleware')
const {
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
} = require('../utils/learningData')

const router = express.Router()
const presentationDirectory = path.join(path.dirname(db.name), 'presentations')
const classworkDirectory = path.join(path.dirname(db.name), 'classwork-files')
const submissionDirectory = path.join(path.dirname(db.name), 'submission-files')
const presentationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
})
const classworkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
})
const submissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
})
const runPresentationUpload = (req, res, next) => {
  presentationUpload.single('presentation')(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Files must be 25 MB or smaller.'
            : 'Could not receive the file.',
      })
    }
    return next()
  })
}
const receiveUpload = (upload, fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Files must be 25 MB or smaller.'
            : 'Could not receive the file.',
      })
    }
    return next()
  })
}

const getFaculty = (userId) =>
  db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(userId)

const recordActivity = ({
  action,
  entityType,
  entityId,
  message,
  faculty,
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
    faculty.id,
    faculty.full_name,
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

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const createJoinCode = () =>
  Array.from(
    { length: 8 },
    () => JOIN_CODE_ALPHABET[crypto.randomInt(JOIN_CODE_ALPHABET.length)],
  ).join('')

const classFields = (body, current = {}) => ({
  className:
    typeof body.className === 'string'
      ? body.className.trim()
      : current.class_name,
  subject:
    typeof body.subject === 'string' ? body.subject.trim() : current.subject,
  subjectCode:
    typeof body.subjectCode === 'string'
      ? body.subjectCode.trim()
      : current.subject_code,
  term: typeof body.term === 'string' ? body.term.trim() : current.term || '',
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
})

const quizFields = (body, current = {}) => {
  const questionList = Array.isArray(body.questionList)
    ? body.questionList
    : safeJsonArray(current.questions_json)
  const questionCount = Number(body.questions)

  return {
    quizTitle:
      typeof body.quizTitle === 'string'
        ? body.quizTitle.trim()
        : typeof body.title === 'string'
          ? body.title.trim()
          : current.quiz_title,
    classId:
      typeof body.classId === 'string'
        ? body.classId
        : typeof body.subjectId === 'string'
          ? body.subjectId
          : current.class_id,
    dueDate:
      typeof body.dueDate === 'string'
        ? body.dueDate.trim()
        : typeof body.due === 'string'
          ? body.due.trim()
          : current.due_date || '',
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
    attemptsAllowed: 1,
    questionList,
  }
}

const ownerClass = (classId, facultyId) =>
  db
    .prepare('SELECT * FROM classes WHERE id = ? AND faculty_id = ?')
    .get(classId, facultyId)

const requireClassworkOwner = (classworkIdParam = 'id') => (req, res, next) => {
  try {
    const classwork = db.prepare(`
      SELECT w.*, c.class_name, c.subject_code, c.faculty_id
      FROM classwork w
      JOIN classes c ON c.id = w.class_id
      WHERE w.id = ? AND c.faculty_id = ?
    `).get(req.params[classworkIdParam], req.userId)
    if (!classwork) {
      return res.status(404).json({ message: 'Classwork not found.' })
    }
    req.classwork = classwork
    req.classId = classwork.class_id
    return next()
  } catch (error) {
    console.error('Classwork ownership check error:', error)
    return res.status(500).json({ message: 'Could not verify classwork access.' })
  }
}

const requireClassworkAccess = (classworkIdParam = 'id') => (req, res, next) => {
  try {
    const classwork = db.prepare(`
      SELECT w.*, c.class_name, c.subject_code, c.faculty_id, c.status AS class_status
      FROM classwork w
      JOIN classes c ON c.id = w.class_id
      WHERE w.id = ? AND (
        (c.faculty_id = ? AND ? = 'Faculty')
        OR (
          c.status = 'Published' AND ? = 'Student'
          AND EXISTS (
            SELECT 1 FROM enrollments e
            WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
          )
        )
      )
    `).get(
      req.params[classworkIdParam],
      req.userId,
      req.userRole,
      req.userRole,
      req.userId,
    )
    if (!classwork) {
      return res.status(404).json({ message: 'Classwork not found.' })
    }
    if (req.userRole === 'Student' && classwork.status !== 'Published') {
      return res.status(404).json({ message: 'Classwork not found.' })
    }
    req.classwork = classwork
    req.classId = classwork.class_id
    return next()
  } catch (error) {
    console.error('Classwork access check error:', error)
    return res.status(500).json({ message: 'Could not verify classwork access.' })
  }
}

const safeUploadName = (value) =>
  String(value || 'attachment')
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 255) || 'attachment'

const isStoredFileId = (value) =>
  typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)

const removeStoredFile = (directory, fileId, label) => {
  if (!isStoredFileId(fileId)) return
  const filePath = path.join(directory, fileId)
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (error) {
    console.error(`Remove ${label} file error:`, error)
  }
}

const mapAnnouncement = (row, comments = []) => ({
  id: row.id,
  message: row.message,
  createdAt: row.createdAt,
  authorName: row.authorName,
  comments,
})

const scopeForRole = (role, alias = 'c') =>
  role === 'Faculty'
    ? `${alias}.faculty_id = ?`
    : `${alias}.status = 'Published' AND EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.class_id = ${alias}.id
          AND e.student_id = ?
          AND e.status = 'Active'
      )`

const isCorrectAnswer = (question, submitted) => {
  const type = question.type || 'multiple_choice'
  if (type === 'checkboxes') {
    const expected = Array.isArray(question.answer)
      ? question.answer.map(Number).sort((a, b) => a - b)
      : []
    const actual = Array.isArray(submitted)
      ? submitted.map(Number).sort((a, b) => a - b)
      : []
    return (
      expected.length > 0 &&
      expected.length === actual.length &&
      expected.every((value, index) => value === actual[index])
    )
  }
  if (type === 'short_answer' || type === 'paragraph') {
    return (
      typeof submitted === 'string' &&
      typeof question.answer === 'string' &&
      submitted.trim().toLocaleLowerCase() ===
        question.answer.trim().toLocaleLowerCase()
    )
  }
  return String(submitted) === String(question.answer)
}

const requireSlideOwner = (req, res, next) => {
  try {
    const slide = db
      .prepare(`
        SELECT s.id FROM slides s
        JOIN classes c ON c.id = s.class_id
        WHERE s.id = ? AND c.faculty_id = ?
      `)
      .get(req.params.id, req.userId)
    if (!slide) return res.status(404).json({ message: 'Lesson not found.' })
    return next()
  } catch (error) {
    console.error('Slide ownership check error:', error)
    return res.status(500).json({ message: 'Could not verify lesson access.' })
  }
}

const presentationForSlide = (slide) => {
  const content = safeJsonArray(slide.content_json)
  const presentation = content[0]?.presentation
  return presentation && typeof presentation === 'object'
    ? presentation
    : null
}

const removePresentationFile = (presentation) => {
  if (
    !presentation?.fileId ||
    !/^[0-9a-f-]{36}(?:\.[a-z0-9]{1,16})?$/i.test(presentation.fileId)
  ) {
    return
  }
  const filePath = path.join(presentationDirectory, presentation.fileId)
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (error) {
    console.error('Remove lesson presentation file error:', error)
  }
}

const previewMimeForFile = (extension, buffer) => {
  if (extension === '.svg') {
    return 'image/svg+xml'
  }
  if (extension === '.bmp' && buffer.subarray(0, 2).toString() === 'BM') {
    return 'image/bmp'
  }
  if (
    extension === '.avif' &&
    buffer.subarray(4, 8).toString() === 'ftyp' &&
    buffer.subarray(8, 12).toString().includes('avif')
  ) {
    return 'image/avif'
  }
  if (
    ['.tif', '.tiff'].includes(extension) &&
    ['49492A00', '4D4D002A'].includes(buffer.subarray(0, 4).toString('hex').toUpperCase())
  ) {
    return 'image/tiff'
  }
  if (
    [
      '.txt',
      '.csv',
      '.tsv',
      '.md',
      '.log',
      '.json',
      '.xml',
      '.html',
      '.htm',
      '.css',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.yml',
      '.yaml',
      '.ini',
      '.sql',
      '.py',
      '.java',
      '.c',
      '.cpp',
      '.h',
      '.sh',
      '.bat',
      '.ps1',
      '.rtf',
    ].includes(extension)
  ) {
    return 'text/plain; charset=utf-8'
  }
  if (
    extension === '.pdf' &&
    buffer.subarray(0, 5).toString() === '%PDF-'
  ) {
    return 'application/pdf'
  }
  if (
    extension === '.png' &&
    buffer.subarray(0, 8).equals(Buffer.from('89504E470D0A1A0A', 'hex'))
  ) {
    return 'image/png'
  }
  if (
    ['.jpg', '.jpeg'].includes(extension) &&
    buffer.subarray(0, 3).equals(Buffer.from('FFD8FF', 'hex'))
  ) {
    return 'image/jpeg'
  }
  if (
    extension === '.gif' &&
    ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())
  ) {
    return 'image/gif'
  }
  if (
    extension === '.webp' &&
    buffer.subarray(0, 4).toString() === 'RIFF' &&
    buffer.subarray(8, 12).toString() === 'WEBP'
  ) {
    return 'image/webp'
  }
  const zipOfficeExtensions = [
    '.docx',
    '.docm',
    '.dotx',
    '.dotm',
    '.xlsx',
    '.xlsm',
    '.xlsb',
    '.xltx',
    '.xltm',
    '.ods',
    '.pptx',
    '.pptm',
    '.ppsx',
    '.potx',
    '.potm',
  ]
  if (
    zipOfficeExtensions.includes(extension) &&
    buffer.subarray(0, 2).toString() === 'PK'
  ) {
    const officeMimeTypes = {
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.docm': 'application/vnd.ms-word.document.macroEnabled.12',
      '.dotx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      '.dotm': 'application/vnd.ms-word.template.macroEnabled.12',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xlsm':
        'application/vnd.ms-excel.sheet.macroEnabled.12',
      '.xlsb': 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
      '.xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
      '.xltm': 'application/vnd.ms-excel.template.macroEnabled.12',
      '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.pptm': 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
      '.ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
      '.potx': 'application/vnd.openxmlformats-officedocument.presentationml.template',
      '.potm': 'application/vnd.ms-powerpoint.template.macroEnabled.12',
    }
    return officeMimeTypes[extension]
  }
  if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(extension)) {
    const audioMimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
    }
    return audioMimeTypes[extension]
  }
  if (['.mp4', '.webm', '.ogv', '.mov'].includes(extension)) {
    const videoMimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogv': 'video/ogg',
      '.mov': 'video/quicktime',
    }
    return videoMimeTypes[extension]
  }
  return null
}

router.get('/bootstrap', requireAuth, requireRole('Faculty', 'Student'), (req, res) => {
  try {
    const scope = scopeForRole(req.userRole)
    const classSelect =
      req.userRole === 'Faculty' ? CLASS_SELECT : STUDENT_CLASS_SELECT
    const classes = db
      .prepare(`${classSelect} WHERE ${scope} ORDER BY c.created_date ASC`)
      .all(req.userId)
    const contentScope =
      req.userRole === 'Faculty'
        ? 'c.faculty_id = ?'
        : `c.status = 'Published' AND q.status = 'Published' AND EXISTS (
            SELECT 1 FROM enrollments e
            WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
          )`
    const quizzes = db
      .prepare(`
        ${QUIZ_SELECT}
        WHERE ${contentScope}
        ORDER BY q.created_date DESC
      `)
      .all(req.userId)
    const slideScope =
      req.userRole === 'Faculty'
        ? 'c.faculty_id = ?'
        : `c.status = 'Published' AND s.status = 'Published' AND EXISTS (
            SELECT 1 FROM enrollments e
            WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
          )`
    const slides = db
      .prepare(`${SLIDE_SELECT} WHERE ${slideScope} ORDER BY s.created_date ASC`)
      .all(req.userId)
    const activity = db
      .prepare(`
        SELECT a.* FROM activity_logs a
        JOIN classes c ON c.id = a.class_id
        WHERE ${scopeForRole(req.userRole)}
        ORDER BY a.created_at DESC LIMIT 20
      `)
      .all(req.userId)

    return res.json({
      classes: classes.map(mapClass),
      quizzes: quizzes.map((quiz) =>
        mapQuiz(quiz, { includeAnswers: req.userRole === 'Faculty' }),
      ),
      slides: slides.map(mapSlide),
      activity: activity.map(mapActivity),
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Learning bootstrap error:', error)
    return res.status(500).json({ message: 'Could not load learning data.' })
  }
})

router.get('/classes', requireAuth, requireRole('Faculty', 'Student'), (req, res) => {
  try {
    const classSelect =
      req.userRole === 'Faculty' ? CLASS_SELECT : STUDENT_CLASS_SELECT
    const classes = db
      .prepare(
        `${classSelect} WHERE ${scopeForRole(req.userRole)} ORDER BY c.created_date ASC`,
      )
      .all(req.userId)
    return res.json({ classes: classes.map(mapClass) })
  } catch (error) {
    console.error('Load classes error:', error)
    return res.status(500).json({ message: 'Could not load classes.' })
  }
})

router.get(
  '/classes/:id',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireClassAccess('id'),
  (req, res) => {
    try {
      const classSelect =
        req.userRole === 'Faculty' ? CLASS_SELECT : STUDENT_CLASS_SELECT
      const row = db
        .prepare(`
          ${classSelect}
          WHERE c.id = ? AND ${scopeForRole(req.userRole)}
        `)
        .get(req.params.id, req.userId)
      if (!row) return res.status(404).json({ message: 'Class not found.' })
      return res.json({ class: mapClass(row) })
    } catch (error) {
      console.error('Load class error:', error)
      return res.status(500).json({ message: 'Could not load the class.' })
    }
  },
)

router.get(
  '/classes/:id/announcements',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireClassAccess('id'),
  (req, res) => {
    try {
      const announcements = db.prepare(`
        SELECT a.id, a.message, a.created_at AS createdAt,
          u.full_name AS authorName
        FROM class_announcements a
        JOIN classes c ON c.id = a.class_id
        JOIN users u ON u.id = a.author_id
        WHERE c.id = ?
          AND (
            (c.faculty_id = ? AND ? = 'Faculty')
            OR (
              c.status = 'Published'
              AND ? = 'Student'
              AND EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.class_id = c.id AND e.student_id = ?
                  AND e.status = 'Active'
              )
            )
          )
        ORDER BY a.created_at DESC
      `).all(req.classId, req.userId, req.userRole, req.userRole, req.userId)
      const comments = announcements.length
        ? db.prepare(`
            SELECT cm.id, cm.announcement_id AS announcementId,
              cm.message, cm.created_at AS createdAt,
              u.full_name AS authorName
            FROM class_announcement_comments cm
            JOIN class_announcements a ON a.id = cm.announcement_id
            JOIN users u ON u.id = cm.author_id
            WHERE a.class_id = ?
            ORDER BY cm.created_at
          `).all(req.classId)
        : []
      const commentsByAnnouncement = new Map()
      comments.forEach((comment) => {
        const { announcementId, ...visibleComment } = comment
        if (!commentsByAnnouncement.has(announcementId)) {
          commentsByAnnouncement.set(announcementId, [])
        }
        commentsByAnnouncement.get(announcementId).push(visibleComment)
      })
      return res.json({
        announcements: announcements.map((announcement) =>
          mapAnnouncement(
            announcement,
            commentsByAnnouncement.get(announcement.id) || [],
          ),
        ),
      })
    } catch (error) {
      console.error('Load class announcements error:', error)
      return res.status(500).json({ message: 'Could not load class announcements.' })
    }
  },
)

router.post(
  '/classes/:id/announcements',
  requireAuth,
  requireRole('Faculty'),
  requireClassOwner('id'),
  (req, res) => {
    const message =
      typeof req.body?.message === 'string' ? req.body.message.trim() : ''
    if (!message || message.length > 5000) {
      return res.status(400).json({
        message: 'Enter an announcement of 1 to 5,000 characters.',
      })
    }

    try {
      const id = crypto.randomUUID()
      db.prepare(`
        INSERT INTO class_announcements (id, class_id, author_id, message)
        VALUES (?, ?, ?, ?)
      `).run(id, req.classId, req.userId, message)
      const announcement = db.prepare(`
        SELECT a.id, a.message, a.created_at AS createdAt,
          u.full_name AS authorName
        FROM class_announcements a
        JOIN users u ON u.id = a.author_id
        WHERE a.id = ? AND a.class_id = ?
      `).get(id, req.classId)
      return res.status(201).json({ announcement: mapAnnouncement(announcement) })
    } catch (error) {
      console.error('Create class announcement error:', error)
      return res.status(500).json({ message: 'Could not create the announcement.' })
    }
  },
)

router.delete(
  '/classes/:id/announcements/:announcementId',
  requireAuth,
  requireRole('Faculty'),
  requireClassOwner('id'),
  (req, res) => {
    try {
      const result = db.prepare(`
        DELETE FROM class_announcements
        WHERE id = ? AND class_id = ? AND author_id = ?
      `).run(req.params.announcementId, req.classId, req.userId)
      if (!result.changes) {
        return res.status(404).json({ message: 'Announcement not found.' })
      }
      return res.json({ message: 'Announcement deleted.' })
    } catch (error) {
      console.error('Delete class announcement error:', error)
      return res.status(500).json({ message: 'Could not delete the announcement.' })
    }
  },
)

router.post(
  '/classes/:id/announcements/:announcementId/comments',
  requireAuth,
  requireRole('Student'),
  requireClassAccess('id'),
  (req, res) => {
    const message =
      typeof req.body?.message === 'string' ? req.body.message.trim() : ''
    if (!message || message.length > 2000) {
      return res.status(400).json({
        message: 'Enter a comment of 1 to 2,000 characters.',
      })
    }
    try {
      const announcement = db.prepare(`
        SELECT a.id FROM class_announcements a
        JOIN classes c ON c.id = a.class_id
        JOIN enrollments e ON e.class_id = c.id
        WHERE a.id = ? AND c.id = ? AND c.status = 'Published'
          AND e.student_id = ? AND e.status = 'Active'
      `).get(req.params.announcementId, req.classId, req.userId)
      if (!announcement) {
        return res.status(404).json({ message: 'Announcement not found.' })
      }
      const id = crypto.randomUUID()
      db.prepare(`
        INSERT INTO class_announcement_comments
          (id, announcement_id, author_id, message)
        VALUES (?, ?, ?, ?)
      `).run(id, announcement.id, req.userId, message)
      const comment = db.prepare(`
        SELECT cm.id, cm.message, cm.created_at AS createdAt,
          u.full_name AS authorName
        FROM class_announcement_comments cm
        JOIN users u ON u.id = cm.author_id
        WHERE cm.id = ?
      `).get(id)
      return res.status(201).json({ comment })
    } catch (error) {
      console.error('Create announcement comment error:', error)
      return res.status(500).json({ message: 'Could not post the comment.' })
    }
  },
)

router.get(
  '/classes/:id/classwork',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireClassAccess('id'),
  (req, res) => {
    try {
      const student = req.userRole === 'Student'
      const rows = db.prepare(`
        SELECT w.*, c.class_name, c.subject_code, c.faculty_id,
          ${student
            ? `CASE
                WHEN sub.status IS NULL AND w.due_at IS NOT NULL
                  AND datetime(w.due_at) < datetime('now') THEN 'missing'
                ELSE COALESCE(sub.status, 'assigned')
              END AS student_status,
              sub.id AS submission_id, sub.grade, sub.submitted_at,
              sub.submission_text, sub.file_id, sub.file_name, sub.file_size,`
            : `NULL AS student_status, NULL AS submission_id, NULL AS grade,
              NULL AS submitted_at, NULL AS submission_text, NULL AS file_id,
              NULL AS file_name, NULL AS file_size,`}
          (SELECT COUNT(*) FROM submissions s
            WHERE s.classwork_id = w.id
              AND s.status IN ('turned_in','graded','returned')
          ) AS submitted_count,
          (SELECT COUNT(*) FROM enrollments e
            WHERE e.class_id = c.id AND e.status = 'Active'
          ) AS student_count
        FROM classwork w
        JOIN classes c ON c.id = w.class_id
        ${student
          ? `LEFT JOIN submissions sub
              ON sub.classwork_id = w.id AND sub.student_id = ?`
          : 'LEFT JOIN submissions sub ON 1 = 0'}
        WHERE c.id = ?
          ${student ? "AND c.status = 'Published' AND w.status = 'Published'" : ''}
        ORDER BY w.due_at IS NULL, w.due_at, w.created_at DESC
      `)
      const rowsForClass = student
        ? rows.all(req.userId, req.classId)
        : rows.all(req.classId)
      return res.json({ classwork: rowsForClass.map(mapClasswork) })
    } catch (error) {
      console.error('Load classwork error:', error)
      return res.status(500).json({ message: 'Could not load classwork.' })
    }
  },
)

router.get(
  '/classes/:id/people',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireClassAccess('id'),
  (req, res) => {
    try {
      const learningClass = db.prepare(`
        SELECT c.id, c.faculty_id, c.status, u.full_name AS teacher_name
        FROM classes c
        JOIN users u ON u.id = c.faculty_id
        WHERE c.id = ?
          AND (? = 'Faculty' OR c.status = 'Published')
      `).get(req.classId, req.userRole)
      if (!learningClass) {
        return res.status(404).json({ message: 'Class not found.' })
      }
      const usernameColumn =
        req.userRole === 'Faculty' ? 'u.username' : 'NULL AS username'
      const students = db.prepare(`
        SELECT u.id, u.full_name AS name, ${usernameColumn}
        FROM enrollments e
        JOIN users u ON u.id = e.student_id AND u.role = 'Student'
        WHERE e.class_id = ? AND e.status = 'Active'
          AND (? = 'Faculty' OR u.id != ?)
        ORDER BY u.full_name
      `).all(req.classId, req.userRole, req.userId)
      return res.json({
        teacher: { id: learningClass.faculty_id, name: learningClass.teacher_name },
        students,
      })
    } catch (error) {
      console.error('Load class people error:', error)
      return res.status(500).json({ message: 'Could not load class people.' })
    }
  },
)

router.post(
  '/classes/:id/classwork',
  requireAuth,
  requireRole('Faculty'),
  requireClassOwner('id'),
  (req, res) => {
    const body = req.body || {}
    const type = body.type
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const instructions =
      typeof body.instructions === 'string' ? body.instructions.trim() : ''
    const status = body.status === 'Draft' ? 'Draft' : 'Published'
    const dueAt = typeof body.dueAt === 'string' ? body.dueAt.trim() : ''
    if (!['assignment', 'quiz', 'material'].includes(type)) {
      return res.status(400).json({ message: 'Choose a valid classwork type.' })
    }
    if (!title || title.length > 200) {
      return res.status(400).json({
        message: 'Enter a title of 1 to 200 characters.',
      })
    }
    if (instructions.length > 10000) {
      return res.status(400).json({
        message: 'Instructions must be 10,000 characters or fewer.',
      })
    }
    let normalizedDueAt = null
    if (dueAt) {
      const dueDate = new Date(dueAt)
      if (Number.isNaN(dueDate.getTime())) {
        return res.status(400).json({ message: 'Enter a valid due date.' })
      }
      if (dueDate.getTime() < Date.now()) {
        return res.status(400).json({ message: 'Due date cannot be in the past.' })
      }
      normalizedDueAt = dueDate.toISOString()
    }

    let quizId = null
    if (type === 'quiz') {
      quizId = typeof body.quizId === 'string' ? body.quizId : ''
      const quiz = quizId && db.prepare(`
        SELECT id FROM quizzes
        WHERE id = ? AND class_id = ?
      `).get(quizId, req.classId)
      if (!quiz) {
        return res.status(400).json({
          message: 'Choose a quiz created for this class.',
        })
      }
    }

    try {
      const id = crypto.randomUUID()
      db.prepare(`
        INSERT INTO classwork
          (id, class_id, type, title, instructions, due_at, status, quiz_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        req.classId,
        type,
        title,
        instructions,
        normalizedDueAt,
        status,
        quizId,
      )
      const row = db.prepare(`
        ${CLASSWORK_SELECT}
        WHERE w.id = ? AND c.faculty_id = ?
      `).get(id, req.userId)
      return res.status(201).json({ classwork: mapClasswork(row) })
    } catch (error) {
      console.error('Create classwork error:', error)
      return res.status(500).json({ message: 'Could not create classwork.' })
    }
  },
)

router.patch(
  '/classwork/:id',
  requireAuth,
  requireRole('Faculty'),
  requireClassworkOwner('id'),
  (req, res) => {
    const body = req.body || {}
    const title =
      typeof body.title === 'string' ? body.title.trim() : req.classwork.title
    const instructions =
      typeof body.instructions === 'string'
        ? body.instructions.trim()
        : req.classwork.instructions
    const status = ['Published', 'Draft'].includes(body.status)
      ? body.status
      : req.classwork.status
    const dueAt =
      typeof body.dueAt === 'string' ? body.dueAt.trim() : req.classwork.due_at
    if (!title || title.length > 200 || instructions.length > 10000) {
      return res.status(400).json({ message: 'Check the title and instructions.' })
    }
    let normalizedDueAt = null
    if (dueAt) {
      const dueDate = new Date(dueAt)
      if (Number.isNaN(dueDate.getTime())) {
        return res.status(400).json({ message: 'Enter a valid due date.' })
      }
      if (dueDate.getTime() < Date.now()) {
        return res.status(400).json({ message: 'Due date cannot be in the past.' })
      }
      normalizedDueAt = dueDate.toISOString()
    }
    try {
      db.prepare(`
        UPDATE classwork
        SET title = ?, instructions = ?, due_at = ?, status = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND class_id IN (
          SELECT id FROM classes WHERE faculty_id = ?
        )
      `).run(title, instructions, normalizedDueAt, status, req.classwork.id, req.userId)
      const row = db.prepare(`
        ${CLASSWORK_SELECT}
        WHERE w.id = ? AND c.faculty_id = ?
      `).get(req.classwork.id, req.userId)
      return res.json({ classwork: mapClasswork(row) })
    } catch (error) {
      console.error('Update classwork error:', error)
      return res.status(500).json({ message: 'Could not update classwork.' })
    }
  },
)

router.delete(
  '/classwork/:id',
  requireAuth,
  requireRole('Faculty'),
  requireClassworkOwner('id'),
  (req, res) => {
    try {
      const attachments = safeJsonArray(req.classwork.attachment_json)
      const files = db.prepare(`
        SELECT s.file_id FROM submissions s
        WHERE s.classwork_id = ? AND s.file_id IS NOT NULL
      `).all(req.classwork.id)
      const removed = db.prepare(`
        DELETE FROM classwork WHERE id = ? AND class_id IN (
          SELECT id FROM classes WHERE faculty_id = ?
        )
      `).run(req.classwork.id, req.userId)
      if (!removed.changes) {
        return res.status(404).json({ message: 'Classwork not found.' })
      }
      attachments.forEach((item) =>
        removeStoredFile(classworkDirectory, item?.fileId, 'classwork attachment'),
      )
      files.forEach((item) =>
        removeStoredFile(submissionDirectory, item.file_id, 'submission'),
      )
      return res.json({ message: 'Classwork deleted.' })
    } catch (error) {
      console.error('Delete classwork error:', error)
      return res.status(500).json({ message: 'Could not delete classwork.' })
    }
  },
)

router.post(
  '/classwork/:id/attachments',
  requireAuth,
  requireRole('Faculty'),
  requireClassworkOwner('id'),
  receiveUpload(classworkUpload, 'file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Choose a file to attach.' })
    }
    const attachments = safeJsonArray(req.classwork.attachment_json)
    if (attachments.length >= 10) {
      return res.status(400).json({ message: 'A classwork item can have up to 10 attachments.' })
    }
    const attachment = {
      fileId: crypto.randomUUID(),
      fileName: safeUploadName(req.file.originalname),
      mimeType: req.file.mimetype || 'application/octet-stream',
      size: req.file.size,
    }
    try {
      fs.mkdirSync(classworkDirectory, { recursive: true })
      fs.writeFileSync(
        path.join(classworkDirectory, attachment.fileId),
        req.file.buffer,
        { flag: 'wx' },
      )
      const nextAttachments = [...attachments, attachment]
      const update = db.prepare(`
        UPDATE classwork
        SET attachment_json = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND class_id IN (
          SELECT id FROM classes WHERE faculty_id = ?
        )
      `).run(
        JSON.stringify(nextAttachments),
        req.classwork.id,
        req.userId,
      )
      if (!update.changes) {
        removeStoredFile(classworkDirectory, attachment.fileId, 'classwork attachment')
        return res.status(404).json({ message: 'Classwork not found.' })
      }
      return res.status(201).json({ attachment })
    } catch (error) {
      removeStoredFile(classworkDirectory, attachment.fileId, 'classwork attachment')
      console.error('Upload classwork attachment error:', error)
      return res.status(500).json({ message: 'Could not save the attachment.' })
    }
  },
)

router.get(
  '/classwork/:id/attachments/:fileId',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireClassworkAccess('id'),
  (req, res) => {
    const attachment = safeJsonArray(req.classwork.attachment_json).find(
      (item) => item?.fileId === req.params.fileId,
    )
    if (!attachment || !isStoredFileId(attachment.fileId)) {
      return res.status(404).json({ message: 'Attachment not found.' })
    }
    const filePath = path.join(classworkDirectory, attachment.fileId)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Attachment file not found.' })
    }
    if (req.query.preview === '1') {
      const extension = path.extname(attachment.fileName).toLowerCase()
      const previewMime = previewMimeForFile(
        extension,
        fs.readFileSync(filePath).subarray(0, 16),
      )
      const safeFileName = safeUploadName(attachment.fileName).replace(/[^\w.-]/g, '_')
      res.setHeader('Content-Type', previewMime || 'application/octet-stream')
      res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return res.sendFile(filePath, (error) => {
        if (error) {
          console.error('Preview classwork attachment error:', error)
          if (!res.headersSent) {
            res.status(404).json({ message: 'Attachment file not found.' })
          }
        }
      })
    }
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.download(filePath, safeUploadName(attachment.fileName), (error) => {
      if (error) {
        console.error('Download classwork attachment error:', error)
        if (!res.headersSent) {
          res.status(404).json({ message: 'Attachment file not found.' })
        }
      }
    })
  },
)

router.get(
  '/classwork/:id/submissions',
  requireAuth,
  requireRole('Faculty'),
  requireClassworkOwner('id'),
  (req, res) => {
    try {
      const submissions = db.prepare(`
        SELECT u.id AS student_id, u.full_name AS student_name,
          u.username AS student_username, s.id AS submission_id,
          COALESCE(s.status, 'assigned') AS status, s.grade,
          s.submission_text, s.file_id, s.file_name, s.file_size,
          s.submitted_at, s.updated_at
        FROM enrollments e
        JOIN users u ON u.id = e.student_id AND u.role = 'Student'
        LEFT JOIN submissions s
          ON s.student_id = e.student_id AND s.classwork_id = ?
        WHERE e.class_id = ? AND e.status = 'Active'
        ORDER BY u.full_name
      `).all(req.classwork.id, req.classId)
      return res.json({
        submissions: submissions.map((row) => ({
          id: row.submission_id,
          studentId: row.student_id,
          studentName: row.student_name,
          studentUsername: row.student_username,
          status: row.status,
          grade: row.grade ?? null,
          text: row.submission_text || '',
          fileId: row.file_id ?? null,
          fileName: row.file_name ?? null,
          fileSize: row.file_size ?? null,
          submittedAt: row.submitted_at ?? null,
          updatedAt: row.updated_at ?? null,
        })),
      })
    } catch (error) {
      console.error('Load classwork submissions error:', error)
      return res.status(500).json({ message: 'Could not load submissions.' })
    }
  },
)

router.get(
  '/classwork/:id/submission',
  requireAuth,
  requireRole('Student'),
  requireClassworkAccess('id'),
  (req, res) => {
    try {
      const row = db.prepare(`
        SELECT id, status, grade, submission_text AS text, file_id AS fileId,
          file_name AS fileName, file_size AS fileSize, submitted_at AS submittedAt
        FROM submissions
        WHERE classwork_id = ? AND student_id = ?
      `).get(req.classwork.id, req.userId)
      return res.json({ submission: row || null })
    } catch (error) {
      console.error('Load student submission error:', error)
      return res.status(500).json({ message: 'Could not load your submission.' })
    }
  },
)

router.post(
  '/classwork/:id/submission',
  requireAuth,
  requireRole('Student'),
  requireClassworkAccess('id'),
  receiveUpload(submissionUpload, 'file'),
  (req, res) => {
    const submissionText =
      typeof req.body?.text === 'string' ? req.body.text.trim() : ''
    if (req.classwork.type !== 'assignment') {
      return res.status(400).json({ message: 'Only assignments accept submissions.' })
    }
    if (!submissionText && !req.file) {
      return res.status(400).json({
        message: 'Add text or choose a file before turning in your work.',
      })
    }
    if (submissionText.length > 10000) {
      return res.status(400).json({ message: 'Submission text must be 10,000 characters or fewer.' })
    }
    let uploadedFileId = null
    try {
      const previous = db.prepare(`
        SELECT id, status, file_id FROM submissions
        WHERE classwork_id = ? AND student_id = ?
      `).get(req.classwork.id, req.userId)
      if (previous?.status === 'graded') {
        return res.status(409).json({
          message: 'This submission has been graded. Ask your teacher to return it before resubmitting.',
        })
      }
      const fileId = req.file ? crypto.randomUUID() : previous?.file_id || null
      uploadedFileId = req.file ? fileId : null
      const fileName = req.file
        ? safeUploadName(req.file.originalname)
        : undefined
      if (req.file) {
        fs.mkdirSync(submissionDirectory, { recursive: true })
        fs.writeFileSync(path.join(submissionDirectory, fileId), req.file.buffer, {
          flag: 'wx',
        })
      }
      db.prepare(`
        INSERT INTO submissions
          (id, classwork_id, student_id, status, submission_text,
           file_id, file_name, file_mime_type, file_size, submitted_at)
        VALUES (?, ?, ?, 'turned_in', ?, ?, ?, ?, ?,
          strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT(classwork_id, student_id)
        DO UPDATE SET status = 'turned_in', grade = NULL,
          submission_text = excluded.submission_text,
          file_id = COALESCE(excluded.file_id, submissions.file_id),
          file_name = COALESCE(excluded.file_name, submissions.file_name),
          file_mime_type = COALESCE(excluded.file_mime_type, submissions.file_mime_type),
          file_size = COALESCE(excluded.file_size, submissions.file_size),
          submitted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `).run(
        previous?.id || crypto.randomUUID(),
        req.classwork.id,
        req.userId,
        submissionText,
        fileId,
        fileName || null,
        req.file?.mimetype || null,
        req.file?.size || null,
      )
      if (req.file && previous?.file_id && previous.file_id !== fileId) {
        removeStoredFile(submissionDirectory, previous.file_id, 'submission')
      }
      const submission = db.prepare(`
        SELECT id, status, grade, submission_text AS text, file_id AS fileId,
          file_name AS fileName, file_size AS fileSize, submitted_at AS submittedAt
        FROM submissions
        WHERE classwork_id = ? AND student_id = ?
      `).get(req.classwork.id, req.userId)
      return res.status(201).json({ submission })
    } catch (error) {
      removeStoredFile(submissionDirectory, uploadedFileId, 'submission')
      console.error('Turn in assignment error:', error)
      return res.status(500).json({ message: 'Could not turn in the assignment.' })
    }
  },
)

router.patch(
  '/classwork/:id/submissions/:studentId',
  requireAuth,
  requireRole('Faculty'),
  requireClassworkOwner('id'),
  (req, res) => {
    const body = req.body || {}
    const status = ['graded', 'returned'].includes(body.status)
      ? body.status
      : body.status === undefined && body.grade !== undefined
        ? 'graded'
        : ''
    const gradeProvided = body.grade !== undefined
    const grade = Number(body.grade)
    if (!status || (gradeProvided && (!Number.isFinite(grade) || grade < 0 || grade > 100))) {
      return res.status(400).json({
        message: 'Provide a grade from 0 to 100 and a valid returned status.',
      })
    }
    try {
      const existing = db.prepare(`
        SELECT s.* FROM submissions s
        JOIN enrollments e ON e.student_id = s.student_id
          AND e.class_id = ? AND e.status = 'Active'
        WHERE s.classwork_id = ? AND s.student_id = ?
      `).get(req.classId, req.classwork.id, req.params.studentId)
      if (!existing || !['turned_in', 'graded', 'returned'].includes(existing.status)) {
        return res.status(404).json({ message: 'Turned-in work not found.' })
      }
      db.prepare(`
        UPDATE submissions
        SET status = ?, grade = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND classwork_id = ?
      `).run(
        status,
        gradeProvided ? grade : existing.grade,
        existing.id,
        req.classwork.id,
      )
      const submission = db.prepare(`
        SELECT s.id, s.student_id AS studentId,
          u.full_name AS studentName, u.username AS studentUsername,
          s.status, s.grade, s.submission_text AS text,
          s.file_id AS fileId, s.file_name AS fileName,
          s.file_size AS fileSize, s.submitted_at AS submittedAt,
          s.updated_at AS updatedAt
        FROM submissions s
        JOIN users u ON u.id = s.student_id
        WHERE s.id = ?
      `).get(existing.id)
      return res.json({ submission })
    } catch (error) {
      console.error('Grade classwork submission error:', error)
      return res.status(500).json({ message: 'Could not update the submission.' })
    }
  },
)

router.get(
  '/submissions/:id/file',
  requireAuth,
  requireRole('Faculty', 'Student'),
  (req, res) => {
    try {
      const submission = db.prepare(`
        SELECT s.file_id, s.file_name, c.faculty_id, c.status AS class_status,
          w.status AS classwork_status, w.class_id, s.student_id
        FROM submissions s
        JOIN classwork w ON w.id = s.classwork_id
        JOIN classes c ON c.id = w.class_id
        WHERE s.id = ?
          AND (
            (c.faculty_id = ? AND ? = 'Faculty')
            OR (s.student_id = ? AND ? = 'Student'
              AND c.status = 'Published' AND w.status = 'Published'
              AND EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
              )
            )
          )
      `).get(
        req.params.id,
        req.userId,
        req.userRole,
        req.userId,
        req.userRole,
        req.userId,
      )
      if (!submission?.file_id || !isStoredFileId(submission.file_id)) {
        return res.status(404).json({ message: 'Submission file not found.' })
      }
      const filePath = path.join(submissionDirectory, submission.file_id)
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Submission file not found.' })
      }
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return res.download(filePath, safeUploadName(submission.file_name), (error) => {
        if (error) {
          console.error('Download submission file error:', error)
          if (!res.headersSent) {
            res.status(404).json({ message: 'Submission file not found.' })
          }
        }
      })
    } catch (error) {
      console.error('Load submission file error:', error)
      return res.status(500).json({ message: 'Could not load the submission file.' })
    }
  },
)

router.post('/classes', requireAuth, requireRole('Faculty'), (req, res) => {
  try {
    const faculty = getFaculty(req.userId)
    const fields = classFields(req.body || {})
    if (!fields.className || fields.className.length < 2) {
      return res.status(400).json({ message: 'Enter a class name with at least 2 characters.' })
    }
    if (!fields.subject || !fields.subjectCode) {
      return res.status(400).json({ message: 'Subject and subject code are required.' })
    }

    const id = `class-${crypto.randomUUID()}`
    const classCode = createClassCode(fields.subjectCode)
    let joinCode = createJoinCode()
    while (db.prepare('SELECT 1 FROM classes WHERE join_code = ?').get(joinCode)) {
      joinCode = createJoinCode()
    }
    db.prepare(`
      INSERT INTO classes
        (id, class_name, subject, subject_code, term, academic_year,
         description, class_code, join_code, status, accent, faculty_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      fields.className,
      fields.subject,
      fields.subjectCode,
      fields.term,
      fields.academicYear,
      fields.description,
      classCode,
      joinCode,
      fields.status,
      fields.accent,
      req.userId,
    )
    recordActivity({
      action: 'class.created',
      entityType: 'class',
      entityId: id,
      message: `Faculty ${faculty.full_name} added a new class: ${fields.className}`,
      faculty,
      classId: id,
    })
    const created = db.prepare(`${CLASS_SELECT} WHERE c.id = ? AND c.faculty_id = ?`)
      .get(id, req.userId)
    return res.status(201).json({ class: mapClass(created) })
  } catch (error) {
    console.error('Create class error:', error)
    return res.status(500).json({ message: 'Could not create the class.' })
  }
})

router.patch(
  '/classes/:id',
  requireAuth,
  requireRole('Faculty'),
  (req, res) => {
    try {
      const current = ownerClass(req.params.id, req.userId)
      if (!current) return res.status(404).json({ message: 'Class not found.' })
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
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND faculty_id = ?
      `).run(
        fields.className,
        fields.subject,
        fields.subjectCode,
        fields.term,
        fields.academicYear,
        fields.description,
        fields.status,
        fields.accent,
        current.id,
        req.userId,
      )
      db.prepare('UPDATE quizzes SET subject_code = ? WHERE class_id = ?').run(
        fields.subjectCode,
        current.id,
      )
      const faculty = getFaculty(req.userId)
      recordActivity({
        action: 'class.updated',
        entityType: 'class',
        entityId: current.id,
        message: `Faculty ${faculty.full_name} updated the class: ${fields.className}`,
        faculty,
        classId: current.id,
      })
      const updated = db
        .prepare(`${CLASS_SELECT} WHERE c.id = ? AND c.faculty_id = ?`)
        .get(current.id, req.userId)
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
      const current = ownerClass(req.params.id, req.userId)
      if (!current) return res.status(404).json({ message: 'Class not found.' })
      const faculty = getFaculty(req.userId)
      const presentations = db
        .prepare('SELECT content_json FROM slides WHERE class_id = ?')
        .all(current.id)
      db.prepare('DELETE FROM classes WHERE id = ? AND faculty_id = ?').run(
        current.id,
        req.userId,
      )
      presentations.forEach((slide) =>
        removePresentationFile(presentationForSlide(slide)),
      )
      recordActivity({
        action: 'class.deleted',
        entityType: 'class',
        entityId: current.id,
        message: `Faculty ${faculty.full_name} removed the class: ${current.class_name}`,
        faculty,
      })
      return res.json({ message: 'Class removed.' })
    } catch (error) {
      console.error('Delete class error:', error)
      return res.status(500).json({ message: 'Could not delete the class.' })
    }
  },
)

router.get('/quizzes', requireAuth, requireRole('Faculty', 'Student'), (req, res) => {
  try {
    const scope =
      req.userRole === 'Faculty'
        ? 'c.faculty_id = ?'
        : `c.status = 'Published' AND q.status = 'Published' AND EXISTS (
            SELECT 1 FROM enrollments e
            WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
          )`
    const quizzes = db
      .prepare(`${QUIZ_SELECT} WHERE ${scope} ORDER BY q.created_date DESC`)
      .all(req.userId)
    return res.json({
      quizzes: quizzes.map((quiz) =>
        mapQuiz(quiz, { includeAnswers: req.userRole === 'Faculty' }),
      ),
    })
  } catch (error) {
    console.error('Load quizzes error:', error)
    return res.status(500).json({ message: 'Could not load quizzes.' })
  }
})

router.get(
  '/quizzes/:id',
  requireAuth,
  requireRole('Faculty', 'Student'),
  (req, res) => {
    try {
      const scope =
        req.userRole === 'Faculty'
          ? 'c.faculty_id = ?'
          : `c.status = 'Published' AND q.status = 'Published' AND EXISTS (
              SELECT 1 FROM enrollments e
              WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
            )`
      const quiz = db
        .prepare(`${QUIZ_SELECT} WHERE q.id = ? AND ${scope}`)
        .get(req.params.id, req.userId)
      if (!quiz) return res.status(404).json({ message: 'Quiz not found.' })
      return res.json({
        quiz: mapQuiz(quiz, { includeAnswers: req.userRole === 'Faculty' }),
      })
    } catch (error) {
      console.error('Load quiz error:', error)
      return res.status(500).json({ message: 'Could not load the quiz.' })
    }
  },
)

router.post(
  '/quizzes/:id/attempts',
  requireAuth,
  requireRole('Student'),
  (req, res) => {
    try {
      const answers = req.body?.answers
      if (
        !answers ||
        typeof answers !== 'object' ||
        Array.isArray(answers)
      ) {
        return res.status(400).json({ message: 'Quiz answers are required.' })
      }

      const attemptId = crypto.randomUUID()
      const submission = db.transaction(() => {
        const quiz = db
          .prepare(`
            ${QUIZ_SELECT}
            WHERE q.id = ? AND q.status = 'Published'
              AND c.status = 'Published'
              AND EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.class_id = c.id AND e.student_id = ?
                  AND e.status = 'Active'
              )
          `)
          .get(req.params.id, req.userId)
        if (!quiz) return { status: 404, message: 'Quiz not found.' }

        const questions = safeJsonArray(quiz.questions_json)
        if (!questions.length) {
          return { status: 400, message: 'This quiz has no questions.' }
        }
        const questionIds = new Set(questions.map((question) => question.id))
        if (Object.keys(answers).some((questionId) => !questionIds.has(questionId))) {
          return { status: 400, message: 'Submitted answers do not match this quiz.' }
        }

        const attemptsUsed = db
          .prepare(
            'SELECT COUNT(*) AS count FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?',
          )
          .get(quiz.id, req.userId).count
        if (attemptsUsed >= 1) {
          return { status: 409, message: 'This quiz can only be taken once.' }
        }

        const correctCount = questions.filter(
          (question) =>
            Object.hasOwn(answers, question.id) &&
            isCorrectAnswer(question, answers[question.id]),
        ).length
        const score = Math.round((correctCount / questions.length) * 100)
        const passed = score >= quiz.passing
        db.prepare(`
          INSERT INTO quiz_attempts
            (id, quiz_id, student_id, score, passed, correct_count, question_count)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          attemptId,
          quiz.id,
          req.userId,
          score,
          passed ? 1 : 0,
          correctCount,
          questions.length,
        )
        const average = db
          .prepare('SELECT AVG(score) AS average FROM quiz_attempts WHERE quiz_id = ?')
          .get(quiz.id).average
        db.prepare(`
          UPDATE quizzes SET attempts = attempts + 1, average = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
        `).run(average, quiz.id)
        return {
          id: attemptId,
          score,
          passed,
          correctCount,
          questionCount: questions.length,
          attemptsUsed: attemptsUsed + 1,
        }
      }).immediate()

      if (submission.status) {
        return res.status(submission.status).json({ message: submission.message })
      }
      return res.status(201).json(submission)
    } catch (error) {
      console.error('Submit quiz error:', error)
      return res.status(500).json({ message: 'Could not submit the quiz.' })
    }
  },
)

router.post('/quizzes', requireAuth, requireRole('Faculty'), (req, res) => {
  try {
    const faculty = getFaculty(req.userId)
    const fields = quizFields(req.body || {})
    if (!fields.quizTitle || fields.quizTitle.length < 2) {
      return res.status(400).json({ message: 'Enter a quiz title with at least 2 characters.' })
    }
    if (!fields.classId) {
      return res.status(400).json({ message: 'Choose a class for the quiz.' })
    }
    const learningClass = ownerClass(fields.classId, req.userId)
    if (!learningClass) return res.status(404).json({ message: 'Class not found.' })

    const id = `quiz-${crypto.randomUUID()}`
    db.prepare(`
      INSERT INTO quizzes
        (id, quiz_title, class_id, subject_code, due_date, status, time_limit,
         max_score, passing, questions, attempts_allowed, questions_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      fields.quizTitle,
      learningClass.id,
      learningClass.subject_code,
      fields.dueDate,
      fields.status,
      fields.timeLimit,
      fields.maxScore,
      fields.passing,
      fields.questions,
      fields.attemptsAllowed,
      JSON.stringify(fields.questionList),
    )
    recordActivity({
      action: 'quiz.created',
      entityType: 'quiz',
      entityId: id,
      message: `Faculty ${faculty.full_name} added a new quiz: ${fields.quizTitle}`,
      faculty,
      classId: learningClass.id,
      quizId: id,
    })
    const created = db.prepare(`${QUIZ_SELECT} WHERE q.id = ? AND c.faculty_id = ?`)
      .get(id, req.userId)
    return res.status(201).json({ quiz: mapQuiz(created) })
  } catch (error) {
    console.error('Create quiz error:', error)
    return res.status(500).json({ message: 'Could not create the quiz.' })
  }
})

router.patch(
  '/quizzes/:id',
  requireAuth,
  requireRole('Faculty'),
  (req, res) => {
    try {
      const current = db
        .prepare(`${QUIZ_SELECT} WHERE q.id = ? AND c.faculty_id = ?`)
        .get(req.params.id, req.userId)
      if (!current) return res.status(404).json({ message: 'Quiz not found.' })
      const fields = quizFields(req.body || {}, current)
      if (!fields.quizTitle || fields.quizTitle.length < 2 || !fields.classId) {
        return res.status(400).json({ message: 'A quiz title and class are required.' })
      }
      const learningClass = ownerClass(fields.classId, req.userId)
      if (!learningClass) return res.status(404).json({ message: 'Class not found.' })

      db.prepare(`
        UPDATE quizzes SET
          quiz_title = ?, class_id = ?, subject_code = ?, due_date = ?,
          status = ?, time_limit = ?, max_score = ?, passing = ?, questions = ?,
          attempts_allowed = ?, questions_json = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND class_id IN (
          SELECT id FROM classes WHERE faculty_id = ?
        )
      `).run(
        fields.quizTitle,
        learningClass.id,
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
        req.userId,
      )
      const faculty = getFaculty(req.userId)
      let action = 'quiz.updated'
      let message = `Faculty ${faculty.full_name} updated the quiz: ${fields.quizTitle}`
      if (fields.dueDate !== current.due_date) {
        action = 'quiz.due_date_updated'
        message = `Faculty ${faculty.full_name} updated the due date for ${fields.quizTitle} to ${fields.dueDate}.`
      } else if (fields.status !== current.status) {
        action = 'quiz.status_updated'
        message = `Faculty ${faculty.full_name} set ${fields.quizTitle} to ${fields.status}.`
      }
      recordActivity({
        action,
        entityType: 'quiz',
        entityId: current.id,
        message,
        faculty,
        classId: learningClass.id,
        quizId: current.id,
      })
      const updated = db
        .prepare(`${QUIZ_SELECT} WHERE q.id = ? AND c.faculty_id = ?`)
        .get(current.id, req.userId)
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
        .prepare(`${QUIZ_SELECT} WHERE q.id = ? AND c.faculty_id = ?`)
        .get(req.params.id, req.userId)
      if (!current) return res.status(404).json({ message: 'Quiz not found.' })
      db.prepare(`
        DELETE FROM quizzes WHERE id = ?
          AND class_id IN (SELECT id FROM classes WHERE faculty_id = ?)
      `).run(current.id, req.userId)
      const faculty = getFaculty(req.userId)
      recordActivity({
        action: 'quiz.deleted',
        entityType: 'quiz',
        entityId: current.id,
        message: `Faculty ${faculty.full_name} removed the quiz: ${current.quiz_title}`,
        faculty,
        classId: current.class_id,
      })
      return res.json({ message: 'Quiz removed.' })
    } catch (error) {
      console.error('Delete quiz error:', error)
      return res.status(500).json({ message: 'Could not delete the quiz.' })
    }
  },
)

router.get('/slides', requireAuth, requireRole('Faculty', 'Student'), (req, res) => {
  try {
    const scope =
      req.userRole === 'Faculty'
        ? 'c.faculty_id = ?'
        : `c.status = 'Published' AND s.status = 'Published' AND EXISTS (
            SELECT 1 FROM enrollments e
            WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
          )`
    const slides = db
      .prepare(`${SLIDE_SELECT} WHERE ${scope} ORDER BY s.created_date ASC`)
      .all(req.userId)
    return res.json({ slides: slides.map(mapSlide) })
  } catch (error) {
    console.error('Load slides error:', error)
    return res.status(500).json({ message: 'Could not load slides.' })
  }
})

router.get(
  '/slides/:id',
  requireAuth,
  requireRole('Faculty', 'Student'),
  (req, res) => {
    try {
      const scope =
        req.userRole === 'Faculty'
          ? 'c.faculty_id = ?'
          : `c.status = 'Published' AND s.status = 'Published' AND EXISTS (
              SELECT 1 FROM enrollments e
              WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
            )`
      const slide = db
        .prepare(`${SLIDE_SELECT} WHERE s.id = ? AND ${scope}`)
        .get(req.params.id, req.userId)
      if (!slide) return res.status(404).json({ message: 'Slide deck not found.' })
      return res.json({ slide: mapSlide(slide) })
    } catch (error) {
      console.error('Load slide error:', error)
      return res.status(500).json({ message: 'Could not load slides.' })
    }
  },
)

router.post(
  '/slides/:id/presentation',
  requireAuth,
  requireRole('Faculty'),
  requireSlideOwner,
  runPresentationUpload,
  (req, res) => {
    let uploadedFileId
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Choose a file to upload.' })
      }

      const slide = db
        .prepare('SELECT content_json FROM slides WHERE id = ?')
        .get(req.params.id)
      const content = safeJsonArray(slide.content_json)
      if (!content.length || !content[0] || typeof content[0] !== 'object') {
        content[0] = {}
      }
      const previousPresentation = presentationForSlide(slide)
      const fileId = crypto.randomUUID()
      uploadedFileId = fileId
      const fileName = path
        .basename(req.file.originalname.replace(/\\/g, '/'))
        .replace(/[\r\n]/g, '')
        .slice(0, 255)
      if (!fileName) {
        return res.status(400).json({ message: 'Choose a file with a valid name.' })
      }
      const mimeType =
        typeof req.file.mimetype === 'string' &&
        /^[\w.+-]+\/[\w.+-]+$/.test(req.file.mimetype)
          ? req.file.mimetype
          : 'application/octet-stream'
      const presentation = {
        fileId,
        fileName,
        mimeType,
        size: req.file.size,
        previewable: true,
      }

      fs.mkdirSync(presentationDirectory, { recursive: true })
      fs.writeFileSync(path.join(presentationDirectory, fileId), req.file.buffer, {
        flag: 'wx',
      })
      content[0].presentation = presentation
      db.prepare(`
        UPDATE slides SET content_json = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `).run(JSON.stringify(content), req.params.id)
      removePresentationFile(previousPresentation)
      return res.status(201).json({ presentation })
    } catch (error) {
      if (uploadedFileId) {
        removePresentationFile({ fileId: uploadedFileId })
      }
      console.error('Upload lesson presentation error:', error)
      return res.status(500).json({ message: 'Could not save the file.' })
    }
  },
)

router.get(
  '/slides/:id/presentation',
  requireAuth,
  requireRole('Faculty', 'Student'),
  (req, res) => {
    try {
      const scope =
        req.userRole === 'Faculty'
          ? 'c.faculty_id = ?'
          : `c.status = 'Published' AND s.status = 'Published' AND EXISTS (
              SELECT 1 FROM enrollments e
              WHERE e.class_id = c.id AND e.student_id = ? AND e.status = 'Active'
            )`
      const slide = db
        .prepare(`${SLIDE_SELECT} WHERE s.id = ? AND ${scope}`)
        .get(req.params.id, req.userId)
      const presentation = slide && presentationForSlide(slide)
      if (!presentation?.fileId) {
        return res.status(404).json({ message: 'Presentation not found.' })
      }

      const fileId = String(presentation.fileId)
      if (!/^[0-9a-f-]{36}(?:\.[a-z0-9]{1,16})?$/i.test(fileId)) {
        return res.status(404).json({ message: 'Presentation not found.' })
      }
      const filePath = path.join(presentationDirectory, fileId)
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found.' })
      }
      const fileName = path.basename(presentation.fileName)
      if (req.query.preview === '1') {
        const extension = path.extname(fileName).toLowerCase()
        const signature = fs.readFileSync(filePath).subarray(0, 16)
        const previewMime = previewMimeForFile(extension, signature)
        const safeFileName = fileName.replace(/[^\w.-]/g, '_')
        res.setHeader('Content-Type', previewMime || 'application/octet-stream')
        res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`)
        res.setHeader('X-Content-Type-Options', 'nosniff')
        return res.sendFile(filePath, (error) => {
          if (error) {
            console.error('Preview lesson file error:', error)
            if (!res.headersSent) {
              res.status(404).json({ message: 'File not found.' })
            }
          }
        })
      }
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return res.download(filePath, fileName, (error) => {
        if (error) {
          console.error('Download lesson presentation error:', error)
          if (!res.headersSent) {
            res.status(404).json({ message: 'Presentation file not found.' })
          }
        }
      })
    } catch (error) {
      console.error('Load lesson presentation error:', error)
      return res.status(500).json({ message: 'Could not load the file.' })
    }
  },
)

router.post('/slides', requireAuth, requireRole('Faculty'), (req, res) => {
  try {
    const { title, content, status, classId } = req.body || {}
    const cleanTitle = typeof title === 'string' ? title.trim() : ''
    if (cleanTitle.length < 2 || !Array.isArray(content)) {
      return res.status(400).json({ message: 'A slide title and slide content are required.' })
    }
    const learningClass = ownerClass(classId, req.userId)
    if (!learningClass) return res.status(404).json({ message: 'Class not found.' })
    const id = `slide-${crypto.randomUUID()}`
    db.prepare(`
      INSERT INTO slides (id, class_id, title, content_json, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, learningClass.id, cleanTitle, JSON.stringify(content),
      status === 'Published' ? 'Published' : 'Draft')
    const created = db
      .prepare(`${SLIDE_SELECT} WHERE s.id = ? AND c.faculty_id = ?`)
      .get(id, req.userId)
    return res.status(201).json({ slide: mapSlide(created) })
  } catch (error) {
    console.error('Create slide error:', error)
    return res.status(500).json({ message: 'Could not create slides.' })
  }
})

router.patch(
  '/slides/:id',
  requireAuth,
  requireRole('Faculty'),
  (req, res) => {
    try {
      const current = db
        .prepare(`${SLIDE_SELECT} WHERE s.id = ? AND c.faculty_id = ?`)
        .get(req.params.id, req.userId)
      if (!current) return res.status(404).json({ message: 'Slide deck not found.' })
      const { title, content, status, classId } = req.body || {}
      const cleanTitle = typeof title === 'string' ? title.trim() : current.title
      const nextContent = Array.isArray(content)
        ? content
        : safeJsonArray(current.content_json)
      const currentPresentation = presentationForSlide(current)
      if (currentPresentation?.fileId) {
        if (!nextContent.length || !nextContent[0] || typeof nextContent[0] !== 'object') {
          nextContent[0] = {}
        }
        nextContent[0].presentation = currentPresentation
      }
      const nextClassId = typeof classId === 'string' ? classId : current.class_id
      const learningClass = ownerClass(nextClassId, req.userId)
      if (!learningClass) return res.status(404).json({ message: 'Class not found.' })
      if (cleanTitle.length < 2) {
        return res.status(400).json({ message: 'Enter a slide deck title with at least 2 characters.' })
      }
      db.prepare(`
        UPDATE slides SET class_id = ?, title = ?, content_json = ?, status = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND class_id IN (
          SELECT id FROM classes WHERE faculty_id = ?
        )
      `).run(
        learningClass.id,
        cleanTitle,
        JSON.stringify(nextContent),
        status === 'Published' ? 'Published' : current.status,
        current.id,
        req.userId,
      )
      const updated = db
        .prepare(`${SLIDE_SELECT} WHERE s.id = ? AND c.faculty_id = ?`)
        .get(current.id, req.userId)
      return res.json({ slide: mapSlide(updated) })
    } catch (error) {
      console.error('Update slide error:', error)
      return res.status(500).json({ message: 'Could not update slides.' })
    }
  },
)

router.delete(
  '/slides/:id',
  requireAuth,
  requireRole('Faculty'),
  (req, res) => {
    try {
      const current = db
        .prepare(`
          SELECT s.content_json FROM slides s
          JOIN classes c ON c.id = s.class_id
          WHERE s.id = ? AND c.faculty_id = ?
        `)
        .get(req.params.id, req.userId)
      if (!current) {
        return res.status(404).json({ message: 'Slide deck not found.' })
      }
      const result = db.prepare(`
        DELETE FROM slides WHERE id = ?
          AND class_id IN (SELECT id FROM classes WHERE faculty_id = ?)
      `).run(req.params.id, req.userId)
      if (!result.changes) {
        return res.status(404).json({ message: 'Slide deck not found.' })
      }
      removePresentationFile(presentationForSlide(current))
      return res.json({ message: 'Slide deck removed.' })
    } catch (error) {
      console.error('Delete slide error:', error)
      return res.status(500).json({ message: 'Could not delete slides.' })
    }
  },
)

router.get('/activity', requireAuth, requireRole('Faculty', 'Student'), (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)
    const activity = db.prepare(`
      SELECT a.* FROM activity_logs a
      JOIN classes c ON c.id = a.class_id
      WHERE ${scopeForRole(req.userRole)}
      ORDER BY a.created_at DESC LIMIT ?
    `).all(req.userId, limit)
    return res.json({ activity: activity.map(mapActivity) })
  } catch (error) {
    console.error('Load activity error:', error)
    return res.status(500).json({ message: 'Could not load recent updates.' })
  }
})

module.exports = router
