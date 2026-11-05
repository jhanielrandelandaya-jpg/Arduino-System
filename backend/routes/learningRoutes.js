const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const express = require('express')
const multer = require('multer')
const { getDatabase } = require('../config/database')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const { requireClassOwner, requireClassOwnerFromBody, requireActiveEnrollment, requireClassAccess, requireClassworkOwner, requireClassworkAccess, requireSlideOwner, requireSlideAccess, requireQuizOwner, requireQuizAccess, getStudentLearningLocks } = require('../middleware/classAccessMiddleware')
const { quizFields } = require('../utils/learningData')
const {
  QUIZ_TIME_LIMIT_MINUTES,
  PASSING_SCORE,
  MAX_QUIZ_QUESTIONS,
  scoreQuiz,
} = require('../utils/quizRules')
const classworkUpload = multer({ storage: multer.memoryStorage() })
const submissionUpload = multer({ storage: multer.memoryStorage() })
const receiveUpload = (upload, field) => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err)
      if (!res.headersSent) {
        return res.status(400).json({ message: 'File upload failed.' })
      }
      return next(err)
    }
    return next()
  })
}
const slideUpload = multer({ storage: multer.memoryStorage() })
const learningDirectory = process.env.LEARNING_DATA_DIR || path.join(__dirname, '..', 'learningData')
const classworkDirectory = process.env.CLASSWORK_DATA_DIR || path.join(learningDirectory, 'classwork')
const submissionDirectory = process.env.SUBMISSION_DATA_DIR || path.join(learningDirectory, 'submissions')
const safeJsonArray = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}
const isStoredFileId = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const safeUploadName = (name) => {
  const base = path.basename(String(name || 'file'))
  const safe = base.replace(/[^A-Za-z0-9._-]/g, '_')
  return safe.length > 80 ? `${safe.slice(0, 77)}${safe.slice(-3)}` : safe
}
const removeStoredFile = (directory, fileId, kind) => {
  try {
    if (!fileId || !isStoredFileId(fileId)) return
    const filePath = path.join(directory, fileId)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (error) {
    console.error(`Remove stored ${kind} failed:`, error)
  }
}
const mapAnnouncement = (row) => ({
  id: row.id,
  classId: row.class_id,
  teacherId: row.teacher_id || row.faculty_id,
  teacherName: row.teacher_name || row.faculty_name || '',
  title: row.title,
  body: row.body,
  created_at: row.created_at || row.created_date,
  author_id: row.author_id,
  author_name: row.author_name,
  comments: safeJsonArray(row.comment_json)
    .map((comment) => ({
      id: comment.id,
      author_id: comment.author_id,
      author_name: comment.author_name,
      text: comment.text,
      created_at: comment.created_at || comment.created_date,
    }))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
})
const presentationForSlide = (slide) => {
  const presentations = safeJsonArray(slide.presentation_json)
  const fileId = presentations.length > 0 ? presentations[presentations.length - 1].fileId : null
  if (!fileId || !isStoredFileId(fileId)) return null
  const directory = process.env.SLIDE_DATA_DIR || path.join(learningDirectory, 'slides')
  const filePath = path.join(directory, fileId)
  if (!fs.existsSync(filePath)) return null
  return { fileId, fileName: safeUploadName(presentations[presentations.length - 1].fileName || 'slide.pdf'), mimeType: presentations[presentations.length - 1].mimeType || 'application/pdf', filePath }
}
const removePresentationFile = (presentation) => {
  try {
    if (!presentation) return
    removeStoredFile(process.env.SLIDE_DATA_DIR || path.join(learningDirectory, 'slides'), presentation.fileId, 'slide presentation')
  } catch (error) {
    console.error('Remove slide presentation failed:', error)
  }
}
const previewMimeForFile = (extension, prefix) => {
  const buffer = Buffer.from(prefix || [])
  const fileExtension = extension.replace(/^\./, '').toLowerCase()
  const isPdf = buffer.subarray(0, 5).toString('latin1') === '%PDF-'
  const isPng = buffer.subarray(0, 8).toString('latin1') === '\u0089PNG\r\n\u001a\u000a'
  const isJpg = buffer.subarray(0, 2).toString('latin1') === '\u00FF\u00D8'
  const isGif = buffer.subarray(0, 3).toString('latin1') === 'GIF'
  const isWebp = buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  const isSvg = fileExtension === 'svg'
  const isJson = fileExtension === 'json'
  const isHtml = fileExtension === 'html' || buffer.subarray(0, 15).toString('latin1') === '<!DOCTYPE html'
  const isCsv = fileExtension === 'csv'
  const isMarkdown = fileExtension === 'md' || buffer.subarray(0, 2).toString('utf8') === '# '
  const isText = ['txt', 'text', 'log'].includes(fileExtension)
  const officeMimeTypes = {
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  const audioMimeTypes = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
    opus: 'audio/opus',
  }
  const videoMimeTypes = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    m4v: 'video/x-m4v',
    ogv: 'video/ogg',
    '3gp': 'video/3gpp',
  }
  const mime =
    isPdf ? 'application/pdf' :
      isPng ? 'image/png' :
        isJpg ? 'image/jpeg' :
          isGif ? 'image/gif' :
            isWebp ? 'image/webp' :
              isSvg ? 'image/svg+xml' :
                audioMimeTypes[fileExtension] ||
                videoMimeTypes[fileExtension] ||
                officeMimeTypes[fileExtension] ||
                (fileExtension === 'json' ? 'application/json' :
                  isHtml ? 'text/html' :
                    isCsv ? 'text/csv' :
                      isMarkdown ? 'text/markdown' :
                        isText ? 'text/plain' :
                          fileExtension === 'zip' ? 'application/zip' :
                            'application/octet-stream')
  return mime
}
const getFaculty = async (req, res, next) => {
  try {
    const database = await getDatabase()
    const faculty = await database.collection('users').findOne({ id: req.userId })
    req.faculty = faculty || null
    req.facultyId = faculty ? faculty.id : null
    return next()
  } catch (error) {
    console.error('Load faculty error:', error)
    return res.status(500).json({ message: 'Could not load the faculty.' })
  }
}
const recordActivity = async ({ action, entityType, entityId, message, faculty, classId }) => {
  try {
    const database = await getDatabase()
    await database.collection('activity').insertOne({
      _id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      action,
      entity_type: entityType,
      entity_id: entityId,
      message,
      faculty_id: faculty ? faculty.id : null,
      faculty_name: faculty ? faculty.full_name : '',
      class_id: classId || null,
      created_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Record activity error:', error)
  }
}
const classFields = (body = {}, current = {}) => {
  const field = (camelCase, snakeCase, currentValue) => {
    const value = body[camelCase] ?? body[snakeCase]
    return typeof value === 'string' ? value.trim() : currentValue
  }
  return {
    className: field('className', 'class_name', current.class_name),
    subject: field('subject', 'subject', current.subject),
    subjectCode: field('subjectCode', 'subject_code', current.subject_code)
      ?.toUpperCase(),
    term: field('term', 'term', current.term),
    academicYear: field('academicYear', 'academic_year', current.academic_year),
    description:
      typeof body.description === 'string'
        ? body.description
        : current.description,
    status:
      body.status === 'Draft' || body.status === 'Published'
        ? body.status
        : current.status,
    accent:
      typeof body.accent === 'string' ? body.accent : current.accent,
  }
}
const mapClass = (row) => ({
  id: row.id,
  class_name: row.class_name,
  subject: row.subject,
  subject_code: row.subject_code,
  term: row.term,
  academic_year: row.academic_year,
  description: row.description,
  class_code: row.class_code,
  join_code: row.join_code,
  status: row.status,
  accent: row.accent,
  faculty_id: row.faculty_id,
  created_date: row.created_date,
  updated_at: row.updated_at,
})
const createClassCode = (subjectCode) => {
  const digits = String(subjectCode || '').replace(/[^0-9]/g, '')
  const prefix = String(subjectCode || '').slice(0, 2).toUpperCase()
  const body = digits.padStart(4, '0').slice(0, 4)
  return `${prefix}-${body}`
}
const createJoinCode = () => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}
const createClassCodeSafe = (subjectCode) => createClassCode(subjectCode)
const ownerClass = async (req, res, next) => {
  try {
    const database = await getDatabase()
    const classRecord = await database.collection('classes').findOne({ id: req.params.id })
    if (!classRecord || classRecord.faculty_id !== req.userId) {
      return res.status(404).json({ message: 'Class not found.' })
    }
    req.classRecord = classRecord
    return next()
  } catch (error) {
    console.error('Load class error:', error)
    return res.status(500).json({ message: 'Could not load the class.' })
  }
}
const mapClasswork = (row) => ({
  ...row,
  class_name: row.class_name,
  subject_code: row.subject_code,
  faculty_id: row.faculty_id,
})
const mapQuiz = (row, context = {}, includeAnswers = true) => {
  const mapped = {
    ...row,
    class_name: context.class_name,
    subject_code: context.subject_code,
    faculty_id: context.faculty_id,
  }
  if (!includeAnswers && typeof row.questions_json === 'string') {
    mapped.questions_json = JSON.stringify(
      safeJsonArray(row.questions_json).map((question) => {
        if (!question || typeof question !== 'object' || Array.isArray(question)) {
          return question
        }
        const {
          answer,
          correctAnswers,
          correct_answer,
          ...studentQuestion
        } = question
        return studentQuestion
      }),
    )
  }
  return mapped
}
const mapSlide = (row, context = {}) => ({
  ...row,
  class_name: context.class_name,
  subject_code: context.subject_code,
  faculty_id: context.faculty_id,
})
const mapActivity = (row) => ({
  id: row.id,
  action: row.action,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  message: row.message,
  faculty_id: row.faculty_id,
  faculty_name: row.faculty_name,
  class_id: row.class_id,
  created_date: row.created_date,
  updated_at: row.updated_at,
})
const mapSubmission = (row, context = {}) => ({
  ...row,
  studentName: context.studentName,
  studentUsername: context.studentUsername,
  className: context.className,
})
const mapQuizAttempt = (row, context = {}) => ({
  ...row,
  class_name: context.class_name,
  subject_code: context.subject_code,
  faculty_id: context.faculty_id,
})
const mapSlidePresentation = (row, context = {}) => ({
  ...row,
  class_name: context.class_name,
  subject_code: context.subject_code,
  faculty_id: context.faculty_id,
})

const compareSlideDate = (left, right) =>
  String(left.created_date || '').localeCompare(String(right.created_date || '')) ||
  String(left.id).localeCompare(String(right.id))

const reorderClassSlides = async (database, classId, slideId, requestedIndex) => {
  const collection = database.collection('slides')
  const slides = await collection.find({ class_id: classId }).toArray()
  const hasCompleteOrder = slides.every((slide) =>
    Number.isInteger(slide.order_index),
  )
  slides.sort(
    hasCompleteOrder
      ? (left, right) => left.order_index - right.order_index
      : compareSlideDate,
  )
  const currentIndex = slides.findIndex((slide) => slide.id === slideId)
  if (currentIndex < 0) return
  const [slide] = slides.splice(currentIndex, 1)
  const index =
    Number.isInteger(requestedIndex) && requestedIndex >= 0
      ? Math.min(requestedIndex, slides.length)
      : slides.length
  slides.splice(index, 0, slide)
  await Promise.all(
    slides.map((item, orderIndex) =>
      collection.updateOne(
        { _id: item._id },
        { $set: { order_index: orderIndex } },
      ),
    ),
  )
}

const router = express.Router()

router.post(
  '/ai/summaries',
  requireAuth,
  requireRole('Faculty'),
  requireClassOwnerFromBody('classId'),
  async (req, res) => {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : ''
    if (req.body.consent !== true) {
      return res.status(400).json({
        message: 'Confirm that you want to send this lesson text to OpenAI.',
      })
    }
    if (!content) {
      return res.status(400).json({ message: 'Add lesson text before generating a summary.' })
    }
    if (content.length > 30000) {
      return res.status(413).json({
        message: 'Lesson text must be 30,000 characters or fewer for AI summarization.',
      })
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        message: 'AI summaries are not configured. Set OPENAI_API_KEY on the backend.',
      })
    }
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 45000)
      try {
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
            instructions:
              'Write a concise, accurate student-facing summary of the lesson. Use only the supplied lesson text. Do not invent facts.',
            input: `Lesson title: ${title || 'Untitled lesson'}\n\nLesson text:\n${content}`,
            max_output_tokens: 180,
          }),
        })
        if (!response.ok) {
          console.error(`OpenAI summary request failed with status ${response.status}.`)
          return res.status(502).json({
            message: `OpenAI could not generate a summary (HTTP ${response.status}). Please try again.`,
          })
        }
        const result = await response.json()
        const summary =
          result.output_text ||
          (Array.isArray(result.output)
            ? result.output
                .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
                .find((item) => item.type === 'output_text')?.text
            : '')
        if (typeof summary !== 'string' || !summary.trim()) {
          console.error('OpenAI summary response did not contain text.')
          return res.status(502).json({
            message: 'OpenAI returned an empty summary. Please try again.',
          })
        }
        return res.json({ summary: summary.trim() })
      } finally {
        clearTimeout(timeout)
      }
    } catch (error) {
      console.error('Generate AI summary error:', error)
      return res.status(502).json({
        message:
          error.name === 'AbortError'
            ? 'The AI summary request timed out. Please try again.'
            : 'Could not reach OpenAI to generate a summary. Please try again.',
      })
    }
  },
)

router.get(
  '/bootstrap',
  requireAuth,
  requireRole('Faculty', 'Student'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const user = await database.collection('users').findOne({ id: req.userId })
      const classes = await database.collection('classes').find({ faculty_id: req.userId }).toArray()
      const enrollments = await database
        .collection('enrollments')
        .find({ student_id: req.userId, status: 'Active' })
        .toArray()
      const learningClasses = []
      const seen = new Set()
      for (const classRecord of classes) {
        const key = classRecord.id
        if (seen.has(key)) continue
        seen.add(key)
        learningClasses.push(classRecord)
      }
      for (const enrollment of enrollments) {
        const classRecord = await database.collection('classes').findOne({ id: enrollment.class_id })
        if (!classRecord) continue
        const key = classRecord.id
        if (seen.has(key)) continue
        seen.add(key)
        learningClasses.push(classRecord)
      }
      const classIds = new Set(learningClasses.map((item) => item.id))
      const faculty = await database.collection('users').find({ id: { $in: learningClasses.map((item) => item.faculty_id) } }).toArray()
      const facultyNames = new Map(faculty.map((item) => [item.id, item.full_name]))
      const classRows = []
      for (const classRecord of learningClasses) {
        const classwork = await database
          .collection('classwork')
          .find({ class_id: classRecord.id, status: 'Published' })
          .toArray()
        classRows.push({
          id: classRecord.id,
          class_name: classRecord.class_name,
          subject: classRecord.subject,
          subject_code: classRecord.subject_code,
          term: classRecord.term,
          academic_year: classRecord.academic_year,
          description: classRecord.description,
          class_code: classRecord.class_code,
          join_code: classRecord.join_code,
          status: classRecord.status,
          accent: classRecord.accent,
          faculty_id: classRecord.faculty_id,
          faculty_name: facultyNames.get(classRecord.faculty_id) || '',
          created_date: classRecord.created_date,
          updated_at: classRecord.updated_at,
          classwork_count: classwork.length,
          student_count: await database.collection('enrollments').countDocuments({ class_id: classRecord.id, status: 'Active' }),
        })
      }
      return res.json({ classes: classRows })
    } catch (error) {
      console.error('Bootstrap error:', error)
      return res.status(500).json({ message: 'Could not load the dashboard.' })
    }
  },
)

router.get(
  '/classes',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireClassAccess('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const user = await database.collection('users').findOne({ id: req.userId })
      const classes = await database
        .collection('classes')
        .find({ $or: [{ faculty_id: req.userId }, { id: { $in: (await database.collection('enrollments').find({ student_id: req.userId, status: 'Active' }).toArray()).map((e) => e.class_id) } }] })
        .toArray()
      const rows = []
      for (const classRecord of classes) {
        const classwork = await database
          .collection('classwork')
          .find({ class_id: classRecord.id, status: 'Published' })
          .toArray()
        rows.push({
          id: classRecord.id,
          class_name: classRecord.class_name,
          subject: classRecord.subject,
          subject_code: classRecord.subject_code,
          term: classRecord.term,
          academic_year: classRecord.academic_year,
          description: classRecord.description,
          class_code: classRecord.class_code,
          join_code: classRecord.join_code,
          status: classRecord.status,
          accent: classRecord.accent,
          faculty_id: classRecord.faculty_id,
          faculty_name: user && user.full_name ? user.full_name : '',
          created_date: classRecord.created_date,
          updated_at: classRecord.updated_at,
          classwork_count: classwork.length,
          student_count: await database.collection('enrollments').countDocuments({ class_id: classRecord.id, status: 'Active' }),
        })
      }
      return res.json({ classes: rows })
    } catch (error) {
      console.error('Load classes error:', error)
      return res.status(500).json({ message: 'Could not load classes.' })
    }
  },
)

router.get(
  '/classes/:id',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireClassAccess('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const classRecord = await database.collection('classes').findOne({ id: req.classId })
      const classwork = await database
        .collection('classwork')
        .find({ class_id: req.classId, status: 'Published' })
        .toArray()
      const announcements = await database
        .collection('announcements')
        .find({ class_id: req.classId })
        .toArray()
      const slides = await database
        .collection('slides')
        .find({ class_id: req.classId, status: 'Published' })
        .toArray()
      const quizzes = await database
        .collection('quizzes')
        .find({ class_id: req.classId, status: 'Published' })
        .toArray()
      const locks =
        req.userRole === 'Student'
          ? await getStudentLearningLocks(database, req.classId, req.userId)
          : { lockedSlideIds: new Set(), lockedQuizIds: new Set() }
      const context = {
        class_name: classRecord ? classRecord.class_name : '',
        subject_code: classRecord ? classRecord.subject_code : '',
        faculty_id: classRecord ? classRecord.faculty_id : null,
      }
      const rows = classwork.map((work) => ({
        ...work,
        class_name: context.class_name,
        subject_code: context.subject_code,
        faculty_id: context.faculty_id,
        student_status: null,
        submission_id: null,
        grade: null,
        submitted_at: null,
        submission_text: '',
        file_id: null,
        file_name: null,
        file_size: null,
        submitted_count: 0,
        student_count: 0,
      }))
      const safeSlides = slides.map((slide) =>
        locks.lockedSlideIds.has(slide.id)
          ? { ...slide, content_json: '[]', locked: true }
          : slide,
      )
      const safeQuizzes = quizzes.map((quiz) => {
        const mapped = mapQuiz(quiz, context, req.userRole !== 'Student')
        return locks.lockedQuizIds.has(quiz.id)
          ? { ...mapped, questions_json: '[]', locked: true }
          : { ...mapped, locked: false }
      })
      return res.json({
        class: { ...classRecord, classwork: rows },
        announcements,
        slides: safeSlides,
        quizzes: safeQuizzes,
      })
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
  async (req, res) => {
    try {
      const database = await getDatabase()
      const announcements = await database
        .collection('announcements')
        .find({ class_id: req.classId })
        .toArray()
      const rows = announcements
        .sort((a, b) => String(b.created_at || b.created_date || '').localeCompare(String(a.created_at || a.created_date || '')))
        .map(mapAnnouncement)
      return res.json({ announcements: rows })
    } catch (error) {
      console.error('Load announcements error:', error)
      return res.status(500).json({ message: 'Could not load announcements.' })
    }
  },
)

router.post(
  '/classes/:id/announcements',
  requireAuth,
  requireRole('Faculty'),
  requireClassOwner('id'),
  async (req, res) => {
    const body = req.body || {}
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const bodyText = typeof body.body === 'string' ? body.body.trim() : ''
    if (!title || title.length < 2 || title.length > 200) {
      return res.status(400).json({ message: 'Announcement title must be 2 to 200 characters.' })
    }
    if (!bodyText) {
      return res.status(400).json({ message: 'Announcement body is required.' })
    }
    try {
      const database = await getDatabase()
      const id = crypto.randomUUID()
      const announcement = {
        _id: id,
        id,
        class_id: req.classId,
        teacher_id: req.userId,
        teacher_name: req.faculty ? req.faculty.full_name : '',
        title,
        body: bodyText,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author_id: req.userId,
        author_name: req.faculty ? req.faculty.full_name : '',
        comment_json: JSON.stringify([]),
      }
      await database.collection('announcements').insertOne(announcement)
      const created = await database.collection('announcements').findOne({ id })
      return res.status(201).json({ announcement: mapAnnouncement(created) })
    } catch (error) {
      console.error('Create announcement error:', error)
      return res.status(500).json({ message: 'Could not create the announcement.' })
    }
  },
)

router.delete(
  '/classes/:id/announcements/:announcementId',
  requireAuth,
  requireRole('Faculty'),
  requireClassOwner('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const deleted = await database
        .collection('announcements')
        .deleteOne({ id: req.params.announcementId, class_id: req.classId })
      if (deleted.deletedCount === 0) {
        return res.status(404).json({ message: 'Announcement not found.' })
      }
      return res.json({ message: 'Announcement deleted.' })
    } catch (error) {
      console.error('Delete announcement error:', error)
      return res.status(500).json({ message: 'Could not delete the announcement.' })
    }
  },
)

router.post(
  '/classes/:id/announcements/:announcementId/comments',
  requireAuth,
  requireRole('Student'),
  requireClassAccess('id'),
  async (req, res) => {
    const body = req.body || {}
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return res.status(400).json({ message: 'Comment text is required.' })
    }
    try {
      const database = await getDatabase()
      const announcement = await database.collection('announcements').findOne({ id: req.params.announcementId })
      if (!announcement) {
        return res.status(404).json({ message: 'Announcement not found.' })
      }
      const comments = safeJsonArray(announcement.comment_json)
      const comment = {
        id: crypto.randomUUID(),
        author_id: req.userId,
        author_name: req.userId,
        text,
        created_at: new Date().toISOString(),
      }
      const nextComments = [...comments, comment]
      await database.collection('announcements').updateOne(
        { _id: announcement._id },
        { $set: { comment_json: JSON.stringify(nextComments) } },
      )
      const updated = await database.collection('announcements').findOne({ id: req.params.announcementId })
      return res.status(201).json({ announcement: mapAnnouncement(updated) })
    } catch (error) {
      console.error('Add comment error:', error)
      return res.status(500).json({ message: 'Could not add the comment.' })
    }
  },
)

router.get(
  '/classes/:id/classwork',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireClassAccess('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const student = req.userRole === 'Student'
      const classworkDocs = await database
        .collection('classwork')
        .find({ class_id: req.classId, status: 'Published' })
        .toArray()
      const rows = []
      for (const work of classworkDocs) {
        const submission = student
          ? await database
              .collection('submissions')
              .findOne({ classwork_id: work.id, student_id: req.userId })
          : null
        const submittedCount = await database
          .collection('submissions')
          .countDocuments({
            classwork_id: work.id,
            status: { $in: ['turned_in', 'graded', 'returned'] },
          })
        const studentCount = await database
          .collection('enrollments')
          .countDocuments({ class_id: work.class_id, status: 'Active' })
        let studentStatus = null
        if (student) {
          const missing =
            !submission &&
            work.due_at !== null &&
            work.due_at !== undefined &&
            new Date(work.due_at).getTime() < Date.now()
          studentStatus = missing
            ? 'missing'
            : submission && submission.status
              ? submission.status
              : 'assigned'
        }
        const classRecord = await database
          .collection('classes')
          .findOne({ id: work.class_id })
        rows.push({
          ...work,
          class_name: classRecord && classRecord.class_name,
          subject_code: classRecord && classRecord.subject_code,
          faculty_id: classRecord && classRecord.faculty_id,
          student_status: studentStatus,
          submission_id: submission ? submission.id : null,
          grade: submission ? submission.grade ?? null : null,
          submitted_at: submission ? submission.submitted_at ?? null : null,
          submission_text: submission ? submission.submission_text || '' : '',
          file_id: submission ? submission.file_id ?? null : null,
          file_name: submission ? submission.file_name ?? null : null,
          file_size: submission ? submission.file_size ?? null : null,
          submitted_count: submittedCount,
          student_count: studentCount,
        })
      }
      rows.sort(
        (a, b) =>
          (a.due_at ? 0 : 1) - (b.due_at ? 0 : 1) ||
          String(a.due_at || '').localeCompare(String(b.due_at || '')) ||
          String(b.created_at || '').localeCompare(String(a.created_at || '')),
      )
      return res.json({ classwork: rows.map(mapClasswork) })
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
  async (req, res) => {
    try {
      const database = await getDatabase()
      const learningClass = await database.collection('classes').findOne({
        id: req.classId,
      })
      if (!learningClass) {
        return res.status(404).json({ message: 'Class not found.' })
      }
      const teacher = await database
        .collection('users')
        .findOne({ id: learningClass.faculty_id })
      const students = await database
        .collection('enrollments')
        .find({ class_id: req.classId, status: 'Active' })
        .toArray()
      const studentRows = []
      for (const enrollment of students) {
        const student = await database
          .collection('users')
          .findOne({ id: enrollment.student_id })
        if (!student || student.role !== 'Student') continue
        studentRows.push({
          id: student.id,
          name: student.full_name,
          username: req.userRole === 'Faculty' ? student.username : undefined,
        })
      }
      studentRows.sort((a, b) => a.name.localeCompare(b.name))
      return res.json({
        teacher: {
          id: learningClass.faculty_id,
          name: teacher ? teacher.full_name : '',
        },
        students: studentRows,
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
  async (req, res) => {
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
      return res.status(400).json({ message: 'Enter a title of 1 to 200 characters.' })
    }
    if (instructions.length > 10000) {
      return res.status(400).json({ message: 'Instructions must be 10,000 characters or fewer.' })
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
      const database = await getDatabase()
      const id = crypto.randomUUID()
      if (type === 'quiz' && body.quizId) {
        const quiz = await database.collection('quizzes').findOne({
          id: body.quizId,
          class_id: req.classId,
        })
        if (!quiz) {
          return res.status(400).json({ message: 'Choose a quiz in this class.' })
        }
      }
      const classRecord = await database
        .collection('classes')
        .findOne({ id: req.classId })
      await database.collection('classwork').insertOne({
        _id: id,
        id,
        class_id: req.classId,
        type,
        title,
        instructions,
        due_at: normalizedDueAt,
        status,
        quiz_id: null,
        attachment_json: JSON.stringify([]),
        created_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      const row = await database.collection('classwork').findOne({ id })
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
  async (req, res) => {
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
      const database = await getDatabase()
      await database.collection('classwork').updateOne(
        { id: req.classwork.id },
        {
          $set: {
            title,
            instructions,
            due_at: normalizedDueAt,
            status,
            updated_at: new Date().toISOString(),
          },
        },
      )
      const row = await database.collection('classwork').findOne({ id: req.classwork.id })
      const classRecord = await database
        .collection('classes')
        .findOne({ id: row.class_id })
      return res.json({
        classwork: {
          ...row,
          class_name: classRecord && classRecord.class_name,
          subject_code: classRecord && classRecord.subject_code,
          faculty_id: classRecord && classRecord.faculty_id,
        },
      })
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
  async (req, res) => {
    try {
      const database = await getDatabase()
      const attachments = safeJsonArray(req.classwork.attachment_json)
      const files = await database
        .collection('submissions')
        .find({ classwork_id: req.classwork.id, file_id: { $ne: null } })
        .toArray()
      const removed = await database.collection('classwork').deleteOne({ id: req.classwork.id })
      if (removed.deletedCount === 0) {
        return res.status(404).json({ message: 'Classwork not found.' })
      }
      for (const item of attachments) {
        removeStoredFile(classworkDirectory, item?.fileId, 'classwork attachment')
      }
      for (const file of files) {
        removeStoredFile(submissionDirectory, file.file_id, 'submission')
      }
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
  async (req, res) => {
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
      const database = await getDatabase()
      fs.mkdirSync(classworkDirectory, { recursive: true })
      fs.writeFileSync(
        path.join(classworkDirectory, attachment.fileId),
        req.file.buffer,
        { flag: 'wx' },
      )
      const nextAttachments = [...attachments, attachment]
      await database.collection('classwork').updateOne(
        { id: req.classwork.id },
        { $set: { attachment_json: JSON.stringify(nextAttachments) } },
      )
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
  async (req, res) => {
    try {
      const database = await getDatabase()
      const submissions = await database
        .collection('submissions')
        .find({ classwork_id: req.classwork.id })
        .toArray()
      const rowsByStudent = new Map()
      for (const submission of submissions) {
        if (submission.status !== 'turned_in') continue
        if (!rowsByStudent.has(submission.student_id)) {
          rowsByStudent.set(submission.student_id, submission)
        }
      }
      const enrollments = await database
        .collection('enrollments')
        .find({ class_id: req.classId, status: 'Active' })
        .toArray()
      const rows = []
      for (const enrollment of enrollments) {
        const student = await database
          .collection('users')
          .findOne({ id: enrollment.student_id })
        if (!student || student.role !== 'Student') continue
        const submission = rowsByStudent.get(student.id) || null
        rows.push({
          id: submission ? submission.id : null,
          studentId: student.id,
          studentName: student.full_name,
          studentUsername: student.username,
          status: submission ? submission.status : 'assigned',
          grade: submission ? submission.grade ?? null : null,
          text: submission ? submission.submission_text || '' : '',
          fileId: submission ? submission.file_id ?? null : null,
          fileName: submission ? submission.file_name ?? null : null,
          fileSize: submission ? submission.file_size ?? null : null,
          submittedAt: submission ? submission.submitted_at ?? null : null,
          updatedAt: submission ? submission.updated_at ?? null : null,
        })
      }
      return res.json({ submissions: rows })
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
  async (req, res) => {
    try {
      const database = await getDatabase()
      const submission = await database
        .collection('submissions')
        .findOne({
          classwork_id: req.classwork.id,
          student_id: req.userId,
        })
      return res.json({ submission })
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
  async (req, res) => {
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
      return res.status(400).json({
        message: 'Submission text must be 10,000 characters or fewer.',
      })
    }
    try {
      const database = await getDatabase()
      const previous = await database
        .collection('submissions')
        .findOne({ classwork_id: req.classwork.id, student_id: req.userId })
      if (previous?.status === 'graded') {
        return res.status(409).json({
          message: 'This submission has been graded. Ask your teacher to return it before resubmitting.',
        })
      }
      const fileId = req.file ? crypto.randomUUID() : previous?.file_id || null
      const fileName = req.file ? safeUploadName(req.file.originalname) : undefined
      let uploadedFileId = null
      if (req.file) {
        uploadedFileId = fileId
        fs.mkdirSync(submissionDirectory, { recursive: true })
        fs.writeFileSync(path.join(submissionDirectory, fileId), req.file.buffer, {
          flag: 'wx',
        })
      }
      const submissionId = previous?.id || crypto.randomUUID()
      const existingDoc = await database
        .collection('submissions')
        .findOne({ id: submissionId })
      if (existingDoc) {
        await database.collection('submissions').updateOne(
          { _id: existingDoc._id },
          {
            $set: {
              status: 'turned_in',
              grade: null,
              submission_text: submissionText,
              file_id: fileId,
              file_name: fileName || null,
              file_mime_type: req.file?.mimetype || null,
              file_size: req.file?.size || null,
              submitted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          },
        )
      } else {
        await database.collection('submissions').insertOne({
          _id: submissionId,
          id: submissionId,
          classwork_id: req.classwork.id,
          student_id: req.userId,
          status: 'turned_in',
          grade: null,
          submission_text: submissionText,
          file_id: fileId,
          file_name: fileName || null,
          file_mime_type: req.file?.mimetype || null,
          file_size: req.file?.size || null,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
      if (req.file && previous?.file_id && previous.file_id !== fileId) {
        removeStoredFile(submissionDirectory, previous.file_id, 'submission')
      }
      const submission = await database
        .collection('submissions')
        .findOne({ classwork_id: req.classwork.id, student_id: req.userId })
      return res.status(201).json({ submission })
    } catch (error) {
      if (uploadedFileId) {
        removeStoredFile(submissionDirectory, uploadedFileId, 'submission')
      }
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
  async (req, res) => {
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
      const database = await getDatabase()
      const submission = await database
        .collection('submissions')
        .findOne({ classwork_id: req.classwork.id, student_id: req.params.studentId })
      if (!submission || !['turned_in', 'graded', 'returned'].includes(submission.status)) {
        return res.status(404).json({ message: 'Turned-in work not found.' })
      }
      await database.collection('submissions').updateOne(
        { _id: submission._id },
        {
          $set: {
            status,
            grade: gradeProvided ? grade : submission.grade,
            updated_at: new Date().toISOString(),
          },
        },
      )
      const updated = await database
        .collection('submissions')
        .findOne({ _id: submission._id })
      const student = await database
        .collection('users')
        .findOne({ id: updated.student_id })
      const learningClass = await database
        .collection('classes')
        .findOne({ id: updated.classwork_id })
      const row = {
        ...updated,
        studentName: student && student.full_name,
        studentUsername: student && student.username,
        className: learningClass && learningClass.class_name,
      }
      return res.json({ submission: row })
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
  async (req, res) => {
    try {
      const database = await getDatabase()
      const submission = await database
        .collection('submissions')
        .findOne({ id: req.params.id })
      if (!submission?.file_id || !isStoredFileId(submission.file_id)) {
        return res.status(404).json({ message: 'Submission file not found.' })
      }
      const classwork = await database
        .collection('classwork')
        .findOne({ id: submission.classwork_id })
      const learningClass = classwork
        ? await database.collection('classes').findOne({ id: classwork.class_id })
        : null
      if (!learningClass) {
        return res.status(404).json({ message: 'Submission file not found.' })
      }
      if (req.userRole === 'Faculty' && learningClass.faculty_id !== req.userId) {
        return res.status(404).json({ message: 'Submission file not found.' })
      }
      if (req.userRole === 'Student') {
        if (submission.student_id !== req.userId) {
          return res.status(404).json({ message: 'Submission file not found.' })
        }
        const enrollment = await database.collection('enrollments').findOne({
          class_id: learningClass.id,
          student_id: req.userId,
          status: 'Active',
        })
        if (!enrollment) {
          return res.status(404).json({ message: 'Submission file not found.' })
        }
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

router.post('/classes', requireAuth, requireRole('Faculty'), async (req, res) => {
  try {
    const database = await getDatabase()
    const faculty = await database
      .collection('users')
      .findOne({ id: req.userId }, { projection: { full_name: 1 } })
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
    let existingClass = await database.collection('classes').findOne({ join_code: joinCode })
    while (existingClass) {
      joinCode = createJoinCode()
      existingClass = await database.collection('classes').findOne({ join_code: joinCode })
    }
    await database.collection('classes').insertOne({
      _id: id,
      id,
      class_name: fields.className,
      subject: fields.subject,
      subject_code: fields.subjectCode,
      term: fields.term,
      academic_year: fields.academicYear,
      description: fields.description,
      class_code: classCode,
      join_code: joinCode,
      status: fields.status,
      accent: fields.accent,
      faculty_id: req.userId,
      created_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    await recordActivity({
      action: 'class.created',
      entityType: 'class',
      entityId: id,
      message: `Faculty ${faculty ? faculty.full_name : ''} added a new class: ${fields.className}`,
      faculty: faculty || { id: req.userId, full_name: '' },
      classId: id,
    })
    const created = await database.collection('classes').findOne({ id })
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
  async (req, res) => {
    try {
      const database = await getDatabase()
      const current = await database.collection('classes').findOne({
        id: req.params.id,
        faculty_id: req.userId,
      })
      if (!current) return res.status(404).json({ message: 'Class not found.' })
      const fields = classFields(req.body || {}, current)
      if (!fields.className || !fields.subject || !fields.subjectCode) {
        return res.status(400).json({
          message: 'Class name, subject, and subject code are required.',
        })
      }
      await database.collection('classes').updateOne(
        { _id: current._id },
        {
          $set: {
            class_name: fields.className,
            subject: fields.subject,
            subject_code: fields.subjectCode,
            term: fields.term,
            academic_year: fields.academicYear,
            description: fields.description,
            status: fields.status,
            accent: fields.accent,
            updated_at: new Date().toISOString(),
          },
        },
      )
      const faculty = await database
        .collection('users')
        .findOne({ id: req.userId }, { projection: { full_name: 1 } })
      await recordActivity({
        action: 'class.updated',
        entityType: 'class',
        entityId: current.id,
        message: `Faculty ${faculty ? faculty.full_name : ''} updated the class: ${fields.className}`,
        faculty: faculty || { id: req.userId, full_name: '' },
        classId: current.id,
      })
      const updated = await database.collection('classes').findOne({
        id: current.id,
        faculty_id: req.userId,
      })
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
  async (req, res) => {
    try {
      const database = await getDatabase()
      const current = await database.collection('classes').findOne({
        id: req.params.id,
        faculty_id: req.userId,
      })
      if (!current) return res.status(404).json({ message: 'Class not found.' })
      const faculty = await database
        .collection('users')
        .findOne({ id: req.userId }, { projection: { full_name: 1 } })
      const slides = await database
        .collection('slides')
        .find({ class_id: current.id })
        .toArray()
      await database.collection('classes').deleteOne({ _id: current._id })
      for (const slide of slides) {
        removePresentationFile(presentationForSlide(slide))
      }
      await recordActivity({
        action: 'class.deleted',
        entityType: 'class',
        entityId: current.id,
        message: `Faculty ${faculty ? faculty.full_name : ''} removed the class: ${current.class_name}`,
        faculty: faculty || { id: req.userId, full_name: '' },
        classId: current.id,
      })
      return res.json({ message: 'Class removed.' })
    } catch (error) {
      console.error('Delete class error:', error)
      return res.status(500).json({ message: 'Could not delete the class.' })
    }
  },
)

router.get(
  '/quizzes',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireClassAccess('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const classRecord = await database.collection('classes').findOne({
        id: req.classId,
      })
      const learningClass =
        classRecord && classRecord.status === 'Published'
          ? classRecord
          : null
      if (!learningClass) {
        return res.status(404).json({ message: 'Class not found.' })
      }
      const quizzes = await database
        .collection('quizzes')
        .find({ class_id: req.classId, status: 'Published' })
        .toArray()
      const locks =
        req.userRole === 'Student'
          ? await getStudentLearningLocks(database, req.classId, req.userId)
          : { lockedSlideIds: new Set(), lockedQuizIds: new Set() }
      const rows = []
      for (const quiz of quizzes) {
        const attemptDocs = await database
          .collection('quiz_attempts')
          .find(
            req.userRole === 'Student'
              ? { quiz_id: quiz.id, student_id: req.userId, status: { $ne: 'In Progress' } }
              : { quiz_id: quiz.id, status: { $ne: 'In Progress' } },
          )
          .toArray()
        const latest = attemptDocs.sort(
          (a, b) => String(b.submitted_at || '').localeCompare(String(a.submitted_at || '')),
        )[0]
        const passedCount = attemptDocs.filter((a) => a.passed).length
        const average = attemptDocs.length
          ? Math.round((attemptDocs.reduce((sum, a) => sum + (Number(a.score) || 0), 0) / attemptDocs.length) * 100) / 100
          : null
        rows.push({
          ...mapQuiz(quiz, {}, req.userRole !== 'Student'),
          status: quiz.status,
          questions: safeJsonArray(quiz.questions_json).length,
          attempts: attemptDocs.length,
          time_limit_minutes: QUIZ_TIME_LIMIT_MINUTES,
          passing: PASSING_SCORE,
          class_name: learningClass.class_name,
          subject_code: learningClass.subject_code,
          faculty_id: learningClass.faculty_id,
          passed_count: passedCount,
          average,
          latest_attempt: latest
            ? { score: latest.score, passed: latest.passed, submitted_at: latest.submitted_at }
            : null,
          locked: locks.lockedQuizIds.has(quiz.id),
          ...(locks.lockedQuizIds.has(quiz.id) ? { questions_json: '[]' } : {}),
        })
      }
      return res.json({ quizzes: rows })
    } catch (error) {
      console.error('Load quizzes error:', error)
      return res.status(500).json({ message: 'Could not load quizzes.' })
    }
  },
)

router.get(
  '/quizzes/:id',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireQuizAccess('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const quiz = await database.collection('quizzes').findOne({ id: req.quiz.id })
      if (req.userRole === 'Student' && quiz.status !== 'Published') {
        return res.status(404).json({ message: 'Quiz not found.' })
      }
      const attempts = await database
        .collection('quiz_attempts')
        .find(
          req.userRole === 'Student'
            ? { quiz_id: quiz.id, student_id: req.userId, status: { $ne: 'In Progress' } }
            : { quiz_id: quiz.id, status: { $ne: 'In Progress' } },
        )
        .toArray()
      const latest = attempts.sort(
        (a, b) => String(b.submitted_at || '').localeCompare(String(a.submitted_at || '')),
      )[0]
      const passedCount = attempts.filter((a) => a.passed).length
      const average = attempts.length
        ? Math.round((attempts.reduce((sum, a) => sum + (Number(a.score) || 0), 0) / attempts.length) * 100) / 100
        : null
      const context = {
        class_name: null,
        subject_code: null,
        faculty_id: null,
      }
      const classRecord = await database.collection('classes').findOne({ id: quiz.class_id })
      if (classRecord) {
        context.class_name = classRecord.class_name
        context.subject_code = classRecord.subject_code
        context.faculty_id = classRecord.faculty_id
      }
      return res.json({
        quiz: {
          ...mapQuiz(quiz, context, req.userRole !== 'Student'),
          questions: safeJsonArray(quiz.questions_json).length,
          time_limit_minutes: QUIZ_TIME_LIMIT_MINUTES,
          passing: PASSING_SCORE,
          attempts_used: req.userRole === 'Student' ? attempts.length : undefined,
          passed: req.userRole === 'Student' ? attempts.some((a) => a.passed) : undefined,
        },
        attempts: req.userRole === 'Faculty' ? attempts : undefined,
        latest_attempt: req.userRole === 'Student' ? latest : undefined,
      })
    } catch (error) {
      console.error('Load quiz error:', error)
      return res.status(500).json({ message: 'Could not load the quiz.' })
    }
  },
)

router.post(
  '/quizzes/:id/attempts/start',
  requireAuth,
  requireRole('Student'),
  requireQuizAccess('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const quiz = await database.collection('quizzes').findOne({ id: req.quiz.id })
      if (quiz.status !== 'Published') {
        return res.status(404).json({ message: 'Quiz not found.' })
      }
      const previousAttempts = await database
        .collection('quiz_attempts')
        .find({ quiz_id: quiz.id, student_id: req.userId })
        .toArray()
      if (previousAttempts.some((attempt) => attempt.passed)) {
        return res.status(409).json({ message: 'You have already passed this quiz.' })
      }
      if (quiz.status !== 'Published') {
        return res.status(404).json({ message: 'Quiz not found.' })
      }

      const now = Date.now()
      const activeAttempt = previousAttempts.find(
        (attempt) => attempt.status === 'In Progress',
      )
      if (activeAttempt) {
        if (now - Date.parse(activeAttempt.started_at) <= QUIZ_TIME_LIMIT_MINUTES * 60 * 1000) {
          return res.json({
            attemptId: activeAttempt.id,
            startedAt: activeAttempt.started_at,
          })
        }
        await database.collection('quiz_attempts').updateOne(
          { id: activeAttempt.id, student_id: req.userId },
          {
            $set: {
              status: 'Submitted',
              timed_out: true,
              score: 0,
              passed: false,
              correct_count: 0,
              question_count: safeJsonArray(quiz.questions_json).length,
              passing: PASSING_SCORE,
              answers_json: '{}',
              submitted_at: new Date(now).toISOString(),
              updated_at: new Date(now).toISOString(),
            },
          },
        )
      }

      const attemptId = crypto.randomUUID()
      const startedAt = new Date().toISOString()
      await database.collection('quiz_attempts').insertOne({
        _id: attemptId,
        id: attemptId,
        quiz_id: quiz.id,
        class_id: quiz.class_id,
        student_id: req.userId,
        status: 'In Progress',
        started_at: startedAt,
        answers_json: '{}',
        score: 0,
        passed: false,
        passing: PASSING_SCORE,
        created_at: startedAt,
      })
      return res.status(201).json({ attemptId, startedAt })
    } catch (error) {
      console.error('Start quiz attempt error:', error)
      return res.status(500).json({ message: 'Could not start the quiz.' })
    }
  },
)

router.post(
  '/quizzes/:id/attempts',
  requireAuth,
  requireRole('Student'),
  requireQuizAccess('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const quiz = await database.collection('quizzes').findOne({ id: req.quiz.id })
      if (!Array.isArray(req.body?.answers) && (
        !req.body?.answers ||
        typeof req.body.answers !== 'object'
      )) {
        return res.status(400).json({ message: 'Submit answers for the quiz.' })
      }
      const previousAttempts = await database
        .collection('quiz_attempts')
        .find({ quiz_id: quiz.id, student_id: req.userId })
        .toArray()
      if (previousAttempts.some((attempt) => attempt.passed)) {
        return res.status(409).json({ message: 'You have already passed this quiz.' })
      }
      const attemptId =
        typeof req.body?.attemptId === 'string' ? req.body.attemptId : ''
      const activeAttempt = previousAttempts.find(
        (attempt) =>
          attempt.id === attemptId && attempt.status === 'In Progress',
      )
      if (!activeAttempt) {
        return res.status(400).json({ message: 'Start the quiz before submitting answers.' })
      }
      const questions = safeJsonArray(quiz.questions_json)
      if (questions.length === 0 || questions.length > 20) {
        return res.status(400).json({ message: 'This quiz has an invalid number of questions.' })
      }
      const answers = req.body.answers
      const timedOut =
        Date.now() - Date.parse(activeAttempt.started_at) > QUIZ_TIME_LIMIT_MINUTES * 60 * 1000
      const { correctCount, score, passed } = scoreQuiz(questions, answers, timedOut)
      const submittedAt = new Date().toISOString()
      const attempt = {
        ...activeAttempt,
        answers_json: JSON.stringify(timedOut ? {} : answers),
        status: 'Submitted',
        score,
        passed,
        timed_out: timedOut,
        correct_count: correctCount,
        question_count: questions.length,
        passing: PASSING_SCORE,
        submitted_at: submittedAt,
        updated_at: submittedAt,
      }
      delete attempt._id
      const updateResult = await database.collection('quiz_attempts').updateOne(
        { id: attemptId, student_id: req.userId, status: 'In Progress' },
        { $set: attempt },
      )
      if (updateResult.modifiedCount !== 1) {
        return res.status(409).json({ message: 'This quiz attempt is no longer active.' })
      }
      const context = {
        class_name: null,
        subject_code: null,
        faculty_id: null,
      }
      const classRecord = await database.collection('classes').findOne({ id: quiz.class_id })
      if (classRecord) {
        context.class_name = classRecord.class_name
        context.subject_code = classRecord.subject_code
        context.faculty_id = classRecord.faculty_id
      }
      const attemptRow = { ...attempt }
      delete attemptRow._id
      return res.status(201).json({
        attempt: mapQuizAttempt(attemptRow, context),
        score,
        passed,
        correctCount,
        questionCount: questions.length,
      })
    } catch (error) {
      console.error('Create quiz attempt error:', error)
      return res.status(500).json({ message: 'Could not start the quiz.' })
    }
  },
)

router.post(
  '/quizzes',
  requireAuth,
  requireRole('Faculty'),
  requireClassOwnerFromBody(),
  async (req, res) => {
    const body = req.body || {}
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description : ''
    const instructions = typeof body.instructions === 'string' ? body.instructions : ''
    const questions = Array.isArray(body.questions)
      ? body.questions
      : Array.isArray(body.questionList)
        ? body.questionList
        : []
    if (!title || title.length < 2 || title.length > 200) {
      return res.status(400).json({ message: 'Quiz title must be 2 to 200 characters.' })
    }
    if (questions.length < 1 || questions.length > MAX_QUIZ_QUESTIONS) {
      return res.status(400).json({ message: `A quiz must contain between 1 and ${MAX_QUIZ_QUESTIONS} questions.` })
    }
    try {
      const database = await getDatabase()
      const id = crypto.randomUUID()
      const quiz = {
        _id: id,
        id,
        class_id: req.classId,
        topic_id: typeof body.topicId === 'string' && body.topicId.trim()
          ? body.topicId.trim()
          : null,
        quiz_title: title,
        title,
        description,
        instructions,
        time_limit: QUIZ_TIME_LIMIT_MINUTES,
        time_limit_minutes: QUIZ_TIME_LIMIT_MINUTES,
        passing: PASSING_SCORE,
        questions: questions.length,
        attempts_allowed: null,
        status: body.status === 'Draft' ? 'Draft' : 'Published',
        questions_json: JSON.stringify(questions),
        created_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (quiz.topic_id) {
        const topic = await database.collection('slides').findOne({
          id: quiz.topic_id,
          class_id: req.classId,
        })
        if (!topic) {
          return res.status(400).json({ message: 'Choose a lesson in the selected class.' })
        }
      }
      await database.collection('quizzes').insertOne(quiz)
      const context = {
        class_name: null,
        subject_code: null,
        faculty_id: null,
      }
      const classRecord = await database.collection('classes').findOne({ id: req.classId })
      if (classRecord) {
        context.class_name = classRecord.class_name
        context.subject_code = classRecord.subject_code
        context.faculty_id = classRecord.faculty_id
      }
      const quizRow = { ...quiz }
      delete quizRow._id
      return res.status(201).json({ quiz: mapQuiz(quizRow, context) })
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
  requireQuizOwner('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const current = await database.collection('quizzes').findOne({ id: req.quiz.id })
      const body = req.body || {}
      const title =
        typeof body.title === 'string'
          ? body.title.trim()
          : current.title || current.quiz_title
      const description = typeof body.description === 'string' ? body.description : current.description
      const instructions = typeof body.instructions === 'string' ? body.instructions : current.instructions
      const status = ['Published', 'Draft'].includes(body.status) ? body.status : current.status
      const topicId =
        typeof body.topicId === 'string'
          ? body.topicId.trim() || null
          : current.topic_id || null
      const questions = Array.isArray(body.questions)
        ? body.questions
        : Array.isArray(body.questionList)
          ? body.questionList
          : safeJsonArray(current.questions_json)
      if (!title || title.length < 2 || title.length > 200) {
        return res.status(400).json({ message: 'Quiz title must be 2 to 200 characters.' })
      }
      if (questions.length < 1 || questions.length > MAX_QUIZ_QUESTIONS) {
        return res.status(400).json({ message: `A quiz must contain between 1 and ${MAX_QUIZ_QUESTIONS} questions.` })
      }
      if (topicId) {
        const topic = await database.collection('slides').findOne({
          id: topicId,
          class_id: current.class_id,
        })
        if (!topic) {
          return res.status(400).json({ message: 'Choose a lesson in the selected class.' })
        }
      }
      await database.collection('quizzes').updateOne(
        { _id: current._id },
        {
          $set: {
            title,
            quiz_title: title,
            description,
            instructions,
            status,
            topic_id: topicId,
            time_limit: QUIZ_TIME_LIMIT_MINUTES,
            time_limit_minutes: QUIZ_TIME_LIMIT_MINUTES,
            passing: PASSING_SCORE,
            questions: questions.length,
            questions_json: JSON.stringify(questions),
            updated_at: new Date().toISOString(),
          },
        },
      )
      const updated = await database.collection('quizzes').findOne({ id: req.quiz.id })
      const context = {
        class_name: null,
        subject_code: null,
        faculty_id: null,
      }
      const classRecord = await database.collection('classes').findOne({ id: updated.class_id })
      if (classRecord) {
        context.class_name = classRecord.class_name
        context.subject_code = classRecord.subject_code
        context.faculty_id = classRecord.faculty_id
      }
      const quizRow = { ...updated }
      delete quizRow._id
      return res.json({ quiz: mapQuiz(quizRow, context) })
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
  requireQuizOwner('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const deleted = await database.collection('quizzes').deleteOne({ id: req.quiz.id })
      if (deleted.deletedCount === 0) {
        return res.status(404).json({ message: 'Quiz not found.' })
      }
      await database.collection('quiz_attempts').deleteMany({ quiz_id: req.quiz.id })
      return res.json({ message: 'Quiz deleted.' })
    } catch (error) {
      console.error('Delete quiz error:', error)
      return res.status(500).json({ message: 'Could not delete the quiz.' })
    }
  },
)

router.get(
  '/slides',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireClassAccess('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const slides = await database
        .collection('slides')
        .find({ class_id: req.classId, status: 'Published' })
        .toArray()
      const locks =
        req.userRole === 'Student'
          ? await getStudentLearningLocks(database, req.classId, req.userId)
          : { lockedSlideIds: new Set(), lockedQuizIds: new Set() }
      const rows = []
      for (const slide of slides) {
        const context = {
          class_name: null,
          subject_code: null,
          faculty_id: null,
        }
        const classRecord = await database.collection('classes').findOne({ id: slide.class_id })
        if (classRecord) {
          context.class_name = classRecord.class_name
          context.subject_code = classRecord.subject_code
          context.faculty_id = classRecord.faculty_id
        }
        const presentations = safeJsonArray(slide.presentation_json)
        const latestPresentation = presentations.length > 0 ? presentations[presentations.length - 1] : null
        rows.push({
          ...(locks.lockedSlideIds.has(slide.id)
            ? { ...slide, content_json: '[]', locked: true }
            : slide),
          status: slide.status,
          class_name: context.class_name,
          subject_code: context.subject_code,
          faculty_id: context.faculty_id,
          presentation_file_id: latestPresentation ? latestPresentation.fileId : null,
          presentation_file_name: latestPresentation ? latestPresentation.fileName || null : null,
          presentation_file_size: latestPresentation ? latestPresentation.size || null : null,
          presentation_mime_type: latestPresentation ? latestPresentation.mimeType || null : null,
        })
      }
      return res.json({ slides: rows })
    } catch (error) {
      console.error('Load slides error:', error)
      return res.status(500).json({ message: 'Could not load slides.' })
    }
  },
)

router.get(
  '/slides/:id',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireSlideAccess('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const slide = await database.collection('slides').findOne({ id: req.slide.id })
      if (req.userRole === 'Student' && slide.status !== 'Published') {
        return res.status(404).json({ message: 'Slide not found.' })
      }
      const context = {
        class_name: null,
        subject_code: null,
        faculty_id: null,
      }
      const classRecord = await database.collection('classes').findOne({ id: slide.class_id })
      if (classRecord) {
        context.class_name = classRecord.class_name
        context.subject_code = classRecord.subject_code
        context.faculty_id = classRecord.faculty_id
      }
      const presentations = safeJsonArray(slide.presentation_json)
      const latestPresentation = presentations.length > 0 ? presentations[presentations.length - 1] : null
      const filePath = latestPresentation
        ? path.join(process.env.SLIDE_DATA_DIR || path.join(learningDirectory, 'slides'), latestPresentation.fileId)
        : null
      const fileExists = filePath ? fs.existsSync(filePath) : false
      return res.json({
        slide: {
          ...slide,
          class_name: context.class_name,
          subject_code: context.subject_code,
          faculty_id: context.faculty_id,
        },
        presentation: latestPresentation,
        fileExists,
        filePath,
      })
    } catch (error) {
      console.error('Load slide error:', error)
      return res.status(500).json({ message: 'Could not load the slide.' })
    }
  },
)

router.post(
  '/slides/:id/presentation',
  requireAuth,
  requireRole('Faculty'),
  requireSlideOwner('id'),
  receiveUpload(slideUpload, 'file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Choose a file to upload.' })
    }
    try {
      const database = await getDatabase()
      const slide = await database.collection('slides').findOne({ id: req.slide.id })
      const presentations = safeJsonArray(slide.presentation_json)
      const fileId = crypto.randomUUID()
      const fileName = safeUploadName(req.file.originalname)
      fs.mkdirSync(process.env.SLIDE_DATA_DIR || path.join(learningDirectory, 'slides'), { recursive: true })
      fs.writeFileSync(path.join(process.env.SLIDE_DATA_DIR || path.join(learningDirectory, 'slides'), fileId), req.file.buffer, { flag: 'wx' })
      const presentation = { fileId, fileName, mimeType: req.file.mimetype || 'application/pdf', size: req.file.size }
      const nextPresentations = [...presentations, presentation]
      await database.collection('slides').updateOne(
        { _id: slide._id },
        { $set: { presentation_json: JSON.stringify(nextPresentations) } },
      )
      return res.status(201).json({ presentation })
    } catch (error) {
      console.error('Upload slide presentation error:', error)
      return res.status(500).json({ message: 'Could not save the presentation.' })
    }
  },
)

router.get(
  '/slides/:id/presentation',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireSlideAccess('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const slide = await database.collection('slides').findOne({ id: req.slide.id })
      const presentations = safeJsonArray(slide.presentation_json)
      const latestPresentation = presentations.length > 0 ? presentations[presentations.length - 1] : null
      if (!latestPresentation || !isStoredFileId(latestPresentation.fileId)) {
        return res.status(404).json({ message: 'Presentation not found.' })
      }
      const filePath = path.join(process.env.SLIDE_DATA_DIR || path.join(learningDirectory, 'slides'), latestPresentation.fileId)
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Presentation file not found.' })
      }
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return res.download(filePath, safeUploadName(latestPresentation.fileName), (error) => {
        if (error) {
          console.error('Download slide presentation error:', error)
          if (!res.headersSent) {
            res.status(404).json({ message: 'Presentation file not found.' })
          }
        }
      })
    } catch (error) {
      console.error('Load slide presentation error:', error)
      return res.status(500).json({ message: 'Could not load the presentation.' })
    }
  },
)

router.post(
  '/slides',
  requireAuth,
  requireRole('Faculty'),
  requireClassOwnerFromBody(),
  async (req, res) => {
    const body = req.body || {}
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description : ''
    const status = body.status === 'Draft' ? 'Draft' : 'Published'
    if (!title || title.length < 2 || title.length > 200) {
      return res.status(400).json({ message: 'Slide title must be 2 to 200 characters.' })
    }
    try {
      const database = await getDatabase()
      const id = crypto.randomUUID()
      const slide = {
        _id: id,
        id,
        class_id: req.classId,
        order_index: Number.isInteger(body.orderIndex) && body.orderIndex >= 0
          ? body.orderIndex
          : null,
        title,
        description,
        status,
        content_json: JSON.stringify(
          Array.isArray(body.content)
            ? body.content.filter(
                (item) => item && typeof item === 'object' && !Array.isArray(item),
              )
            : [],
        ),
        slide_json: JSON.stringify([]),
        created_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await database.collection('slides').insertOne(slide)
      await reorderClassSlides(
        database,
        req.classId,
        id,
        Number.isInteger(body.orderIndex) && body.orderIndex >= 0
          ? body.orderIndex
          : undefined,
      )
      const context = {
        class_name: null,
        subject_code: null,
        faculty_id: null,
      }
      const classRecord = await database.collection('classes').findOne({ id: req.classId })
      if (classRecord) {
        context.class_name = classRecord.class_name
        context.subject_code = classRecord.subject_code
        context.faculty_id = classRecord.faculty_id
      }
      const savedSlide = await database.collection('slides').findOne({ id })
      const slideRow = { ...savedSlide }
      delete slideRow._id
      return res.status(201).json({ slide: mapSlide(slideRow, context) })
    } catch (error) {
      console.error('Create slide error:', error)
      return res.status(500).json({ message: 'Could not create the slide.' })
    }
  },
)

router.patch(
  '/slides/:id',
  requireAuth,
  requireRole('Faculty'),
  requireSlideOwner('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const current = await database.collection('slides').findOne({ id: req.slide.id })
      const body = req.body || {}
      const title = typeof body.title === 'string' ? body.title.trim() : current.title
      const description = typeof body.description === 'string' ? body.description : current.description
      const status = ['Published', 'Draft'].includes(body.status) ? body.status : current.status
      const contentJson = Array.isArray(body.content)
        ? JSON.stringify(
            body.content.filter(
              (item) => item && typeof item === 'object' && !Array.isArray(item),
            ),
          )
        : current.content_json || '[]'
      await database.collection('slides').updateOne(
        { _id: current._id },
        {
          $set: {
            title,
            description,
            status,
            content_json: contentJson,
            updated_at: new Date().toISOString(),
          },
        },
      )
      if (Number.isInteger(body.orderIndex) && body.orderIndex >= 0) {
        await reorderClassSlides(
          database,
          current.class_id,
          current.id,
          body.orderIndex,
        )
      }
      const updated = await database.collection('slides').findOne({ id: req.slide.id })
      const context = {
        class_name: null,
        subject_code: null,
        faculty_id: null,
      }
      const classRecord = await database.collection('classes').findOne({ id: updated.class_id })
      if (classRecord) {
        context.class_name = classRecord.class_name
        context.subject_code = classRecord.subject_code
        context.faculty_id = classRecord.faculty_id
      }
      const slideRow = { ...updated }
      delete slideRow._id
      return res.json({ slide: mapSlide(slideRow, context) })
    } catch (error) {
      console.error('Update slide error:', error)
      return res.status(500).json({ message: 'Could not update the slide.' })
    }
  },
)

router.delete(
  '/slides/:id',
  requireAuth,
  requireRole('Faculty'),
  requireSlideOwner('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const slide = await database.collection('slides').findOne({ id: req.slide.id })
      if (!slide) {
        return res.status(404).json({ message: 'Slide not found.' })
      }
      const deleted = await database.collection('slides').deleteOne({ id: req.slide.id })
      if (deleted.deletedCount === 0) {
        return res.status(404).json({ message: 'Slide not found.' })
      }
      safeJsonArray(slide.presentation_json).forEach(removePresentationFile)
      return res.json({ message: 'Slide deleted.' })
    } catch (error) {
      console.error('Delete slide error:', error)
      return res.status(500).json({ message: 'Could not delete the slide.' })
    }
  },
)

router.get(
  '/activity',
  requireAuth,
  requireRole('Faculty', 'Student'),
  requireClassAccess('id'),
  async (req, res) => {
    try {
      const database = await getDatabase()
      const activities = await database
        .collection('activities')
        .find({ class_id: req.classId })
        .toArray()
      const rows = activities
        .sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')))
        .map(mapActivity)
      return res.json({ activities: rows })
    } catch (error) {
      console.error('Load activities error:', error)
      return res.status(500).json({ message: 'Could not load activities.' })
    }
  },
)

module.exports = router
