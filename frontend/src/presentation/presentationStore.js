import {
  buildPresentationFromLesson,
  duplicatePresentation,
} from './presentationData.js'

const STORAGE_KEY = 'learnspace_presentations_v1'

const storageKey = (userId) => `${STORAGE_KEY}_${userId}`

const readStorage = (userId) => {
  try {
    const stored = window.localStorage.getItem(storageKey(userId))
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

const writeStorage = (presentations, userId) => {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(presentations))
  } catch {
    // Presentation editing still works for the current session.
  }
}

export const loadPresentations = (userId) => {
  const stored = readStorage(userId)
  return stored || []
}

export const loadPresentation = (id, userId) =>
  loadPresentations(userId).find((presentation) => presentation.id === id) || null

export const savePresentation = (presentation, userId) => {
  const presentations = loadPresentations(userId)
  const saved = { ...presentation, updatedAt: new Date().toISOString() }
  const exists = presentations.some((item) => item.id === saved.id)
  writeStorage(
    exists
      ? presentations.map((item) => (item.id === saved.id ? saved : item))
      : [saved, ...presentations],
    userId,
  )
  return saved
}

export const addPresentation = (presentation, userId) => {
  const presentations = loadPresentations(userId)
  writeStorage([presentation, ...presentations], userId)
  return presentation
}

export const copyPresentation = (presentation, userId) => {
  const copy = duplicatePresentation(presentation)
  addPresentation(copy, userId)
  return copy
}

export const removePresentation = (id, userId) => {
  writeStorage(
    loadPresentations(userId).filter((presentation) => presentation.id !== id),
    userId,
  )
}

export const ensurePresentationForLesson = (lesson, userId) => {
  const presentations = loadPresentations(userId)
  const sourceFile =
    typeof lesson.presentation === 'string'
      ? lesson.presentation
      : lesson.presentation?.name || ''
  const existing = presentations.find((presentation) => {
    if (sourceFile && presentation.sourceFile === sourceFile) return true
    if (presentation.lessonId === lesson.id) return true
    return (
      presentation.title === lesson.title &&
      presentation.subjectCode === lesson.subjectCode
    )
  })

  if (existing) return existing

  const presentation = buildPresentationFromLesson({
    ...lesson,
    presentation: sourceFile
      ? { name: sourceFile, slides: 0, size: '0 MB' }
      : lesson.presentation,
  })
  addPresentation(presentation, userId)
  return presentation
}
