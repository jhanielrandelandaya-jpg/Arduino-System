import {
  PRESENTATION_SEEDS,
  buildPresentationFromLesson,
  duplicatePresentation,
} from './presentationData.js'

const STORAGE_KEY = 'learnspace_presentations_v1'

const clone = (value) => JSON.parse(JSON.stringify(value))

const readStorage = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

const writeStorage = (presentations) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presentations))
  } catch {
    // Presentation editing still works for the current session.
  }
}

export const loadPresentations = () => {
  const stored = readStorage()
  if (stored) return stored
  const seeds = clone(PRESENTATION_SEEDS)
  writeStorage(seeds)
  return seeds
}

export const loadPresentation = (id) =>
  loadPresentations().find((presentation) => presentation.id === id) || null

export const savePresentation = (presentation) => {
  const presentations = loadPresentations()
  const saved = { ...presentation, updatedAt: new Date().toISOString() }
  const exists = presentations.some((item) => item.id === saved.id)
  writeStorage(
    exists
      ? presentations.map((item) => (item.id === saved.id ? saved : item))
      : [saved, ...presentations],
  )
  return saved
}

export const addPresentation = (presentation) => {
  const presentations = loadPresentations()
  writeStorage([presentation, ...presentations])
  return presentation
}

export const copyPresentation = (presentation) => {
  const copy = duplicatePresentation(presentation)
  addPresentation(copy)
  return copy
}

export const removePresentation = (id) => {
  writeStorage(loadPresentations().filter((presentation) => presentation.id !== id))
}

export const ensurePresentationForLesson = (lesson) => {
  const presentations = loadPresentations()
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
  addPresentation(presentation)
  return presentation
}
