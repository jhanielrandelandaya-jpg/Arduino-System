import { useCallback, useEffect, useRef, useState } from 'react'
import { apiUrl } from '../utils/apiUrl'

const TOKEN_KEY = 'learnspace_token'
const SYNC_KEY = 'learnspace_learning_sync'

const getToken = () => {
  try {
    return (
      window.localStorage.getItem(TOKEN_KEY) ||
      window.sessionStorage.getItem(TOKEN_KEY)
    )
  } catch {
    return null
  }
}

const authHeaders = () => {
  const token = getToken()
  return token ? { Authorization: 'Bearer ' + token } : {}
}

const request = async (path, options = {}, basePath = '/api/learning') => {
  const token = getToken()
  const response = await fetch(apiUrl(`${basePath}${path}`), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'The learning data request failed.')
  }

  return data
}

export const signalLearningChange = () => {
  try {
    window.localStorage.setItem(SYNC_KEY, String(Date.now()))
  } catch {
    // Other tabs still receive changes through polling.
  }
  window.dispatchEvent(new Event('learnspace:learning-change'))
}

export function useLearningData({ role, pollInterval = 3000 } = {}) {
  const [classes, setClasses] = useState([])
  const [quizzes, setQuizzes] = useState([])
  const [slides, setSlides] = useState([])
  const [students, setStudents] = useState([])
  const [classwork, setClasswork] = useState([])
  const [quizAttempts, setQuizAttempts] = useState([])
  const [practiceQuizzes, setPracticeQuizzes] = useState([])
  const [activity, setActivity] = useState([])
  const [syncedAt, setSyncedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const mounted = useRef(true)

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest

    if (!silent) {
      setLoading(true)
    }

    try {
      const dashboardRole = role === 'Faculty' ? 'faculty' : 'student'
      const data = await request(`/${dashboardRole}/dashboard`, {}, '/api')

      if (!mounted.current || requestId.current !== currentRequest) {
        return data
      }

      setClasses(Array.isArray(data.classes) ? data.classes : [])
      setQuizzes(Array.isArray(data.quizzes) ? data.quizzes : [])
      setSlides(Array.isArray(data.slides) ? data.slides : [])
      setStudents(Array.isArray(data.students) ? data.students : [])
      setClasswork(Array.isArray(data.classwork) ? data.classwork : [])
      setQuizAttempts(Array.isArray(data.attempts) ? data.attempts : [])
      setPracticeQuizzes(
        Array.isArray(data.practiceQuizzes) ? data.practiceQuizzes : [],
      )
      setActivity(Array.isArray(data.activity) ? data.activity : [])
      setSyncedAt(data.syncedAt || new Date().toISOString())
      setError('')
      return data
    } catch (loadError) {
      if (mounted.current && requestId.current === currentRequest) {
        setError(loadError.message)
      }
      return null
    } finally {
      if (mounted.current && requestId.current === currentRequest) {
        setLoading(false)
      }
    }
  }, [role])

  useEffect(() => {
    mounted.current = true
    const initialLoad = window.setTimeout(() => refresh(), 0)

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh({ silent: true })
      }
    }, pollInterval)

    const handleFocus = () => refresh({ silent: true })
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh({ silent: true })
      }
    }
    const handleStorage = (event) => {
      if (event.key === SYNC_KEY) {
        refresh({ silent: true })
      }
    }
    const handleLocalChange = () => refresh({ silent: true })

    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorage)
    window.addEventListener('learnspace:learning-change', handleLocalChange)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      mounted.current = false
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(
        'learnspace:learning-change',
        handleLocalChange,
      )
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [pollInterval, refresh])

  const mutate = useCallback(
    async (path, options = {}) => {
      const data = await request(path, options)
      await refresh({ silent: true })
      signalLearningChange()
      return data
    },
    [refresh],
  )

  const createClass = useCallback(
    (payload) =>
      mutate('/classes', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    [mutate],
  )

  const updateClass = useCallback(
    (id, payload) =>
      mutate(`/classes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    [mutate],
  )

  const deleteClass = useCallback(
    (id) => mutate(`/classes/${id}`, { method: 'DELETE' }),
    [mutate],
  )

  const createQuiz = useCallback(
    (payload) =>
      mutate('/quizzes', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    [mutate],
  )

  const updateQuiz = useCallback(
    (id, payload) =>
      mutate(`/quizzes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    [mutate],
  )

  const deleteQuiz = useCallback(
    (id) => mutate(`/quizzes/${id}`, { method: 'DELETE' }),
    [mutate],
  )

  const submitQuizAttempt = useCallback(
    (quizId, attemptId, answers) =>
      mutate(`/quizzes/${encodeURIComponent(quizId)}/attempts`, {
        method: 'POST',
        body: JSON.stringify({ attemptId, answers }),
      }),
    [mutate],
  )

  const startQuizAttempt = useCallback(
    (quizId) =>
      mutate(`/quizzes/${encodeURIComponent(quizId)}/attempts/start`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    [mutate],
  )

  const generateLessonSummary = useCallback(
    async (classId, title, content) => {
      const data = await request('/ai/summaries', {
        method: 'POST',
        body: JSON.stringify({ classId, title, content, consent: true }),
      })
      return data.summary
    },
    [],
  )

  const createPracticeQuiz = useCallback(
    async (payload) => {
      const data = await request(
        '/practice-quizzes',
        { method: 'POST', body: JSON.stringify(payload) },
        '/api/student',
      )
      await refresh({ silent: true })
      signalLearningChange()
      return data.practiceQuiz
    },
    [refresh],
  )

  const deletePracticeQuiz = useCallback(
    async (quizId) => {
      const data = await request(
        `/practice-quizzes/${encodeURIComponent(quizId)}`,
        { method: 'DELETE' },
        '/api/student',
      )
      await refresh({ silent: true })
      signalLearningChange()
      return data
    },
    [refresh],
  )

  const startPracticeQuizAttempt = useCallback(
    async (quizId) => {
      const data = await request(
        `/practice-quizzes/${encodeURIComponent(quizId)}/attempts/start`,
        { method: 'POST', body: JSON.stringify({}) },
        '/api/student',
      )
      return data
    },
    [],
  )

  const submitPracticeQuizAttempt = useCallback(
    async (quizId, attemptId, answers) => {
      const data = await request(
        `/practice-quizzes/${encodeURIComponent(quizId)}/attempts`,
        { method: 'POST', body: JSON.stringify({ attemptId, answers }) },
        '/api/student',
      )
      await refresh({ silent: true })
      signalLearningChange()
      return data
    },
    [refresh],
  )

  const createSlide = useCallback(
    (payload) =>
      mutate('/slides', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    [mutate],
  )

  const updateSlide = useCallback(
    (id, payload) =>
      mutate(`/slides/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    [mutate],
  )

  const deleteSlide = useCallback(
    (id) => mutate(`/slides/${id}`, { method: 'DELETE' }),
    [mutate],
  )

  const enrollClass = useCallback(
    async (classCode) => {
      const data = await request(
        '/enrollments',
        {
          method: 'POST',
          body: JSON.stringify({ classCode }),
        },
        '/api/student',
      )
      await refresh({ silent: true })
      signalLearningChange()
      return data
    },
    [refresh],
  )

  const getStudentNotes = useCallback(async () => {
    const data = await request('/notes', {}, '/api/student')
    return Array.isArray(data.notes) ? data.notes : []
  }, [])

  const createStudentNote = useCallback(async (payload) => {
    const data = await request(
      '/notes',
      { method: 'POST', body: JSON.stringify(payload) },
      '/api/student',
    )
    signalLearningChange()
    return data.note
  }, [])

  const updateStudentNote = useCallback(async (noteId, payload) => {
    const data = await request(
      `/notes/${encodeURIComponent(noteId)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      '/api/student',
    )
    signalLearningChange()
    return data.note
  }, [])

  const deleteStudentNote = useCallback(async (noteId) => {
    const data = await request(
      `/notes/${encodeURIComponent(noteId)}`,
      { method: 'DELETE' },
      '/api/student',
    )
    signalLearningChange()
    return data
  }, [])

  const getClassStudents = useCallback(async (classId) => {
    const data = await request(
      `/classes/${encodeURIComponent(classId)}/students`,
      {},
      '/api/faculty',
    )
    return Array.isArray(data.students) ? data.students : []
  }, [])

  const getClassQuizAttempts = useCallback(async (classId) => {
    const data = await request(
      `/classes/${encodeURIComponent(classId)}/quiz-attempts`,
      {},
      '/api/faculty',
    )
    return Array.isArray(data.attempts) ? data.attempts : []
  }, [])

  const getClassAnnouncements = useCallback(async (classId) => {
    const data = await request(
      `/classes/${encodeURIComponent(classId)}/announcements`,
    )
    return Array.isArray(data.announcements) ? data.announcements : []
  }, [])

  const createClassAnnouncement = useCallback(
    (classId, message) =>
      mutate(`/classes/${encodeURIComponent(classId)}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
    [mutate],
  )

  const deleteClassAnnouncement = useCallback(
    (classId, announcementId) =>
      mutate(
        `/classes/${encodeURIComponent(classId)}/announcements/${encodeURIComponent(announcementId)}`,
        { method: 'DELETE' },
      ),
    [mutate],
  )

  const addAnnouncementComment = useCallback(
    async (classId, announcementId, message) => {
      const data = await request(
        `/classes/${encodeURIComponent(classId)}/announcements/${encodeURIComponent(announcementId)}/comments`,
        { method: 'POST', body: JSON.stringify({ message }) },
      )
      signalLearningChange()
      return data.comment
    },
    [],
  )

  const getClasswork = useCallback(async (classId) => {
    const data = await request(
      `/classes/${encodeURIComponent(classId)}/classwork`,
    )
    return Array.isArray(data.classwork) ? data.classwork : []
  }, [])

  const getClassPeople = useCallback(async (classId) => {
    const data = await request(
      `/classes/${encodeURIComponent(classId)}/people`,
    )
    return {
      teacher: data.teacher || null,
      students: Array.isArray(data.students) ? data.students : [],
    }
  }, [])

  const createClasswork = useCallback(
    (classId, payload) =>
      mutate(`/classes/${encodeURIComponent(classId)}/classwork`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    [mutate],
  )

  const deleteClasswork = useCallback(
    (classworkId) =>
      mutate(`/classwork/${encodeURIComponent(classworkId)}`, {
        method: 'DELETE',
      }),
    [mutate],
  )

  const uploadClassworkAttachment = useCallback(
    async (classworkId, file) => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(
        apiUrl(`/api/learning/classwork/${encodeURIComponent(classworkId)}/attachments`),
        { method: 'POST', headers: authHeaders(), body: formData },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.message || 'Could not upload the attachment.')
      }
      await refresh({ silent: true })
      signalLearningChange()
      return data.attachment
    },
    [refresh],
  )

  const downloadClassworkAttachment = useCallback(
    async (classworkId, attachment) => {
      const response = await fetch(
        apiUrl(`/api/learning/classwork/${encodeURIComponent(classworkId)}/attachments/${encodeURIComponent(attachment.fileId)}`),
        { headers: authHeaders() },
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Could not download the attachment.')
      }
      const objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = attachment.fileName || 'classwork-attachment'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    },
    [],
  )

  const previewClassworkAttachment = useCallback(
    async (classworkId, attachment) => {
      const response = await fetch(
        apiUrl(`/api/learning/classwork/${encodeURIComponent(classworkId)}/attachments/${encodeURIComponent(attachment.fileId)}?preview=1`),
        { headers: authHeaders() },
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Could not preview the attachment.')
      }
      const blob = await response.blob()
      return {
        url: URL.createObjectURL(blob),
        blob,
        contentType: response.headers.get('Content-Type') || '',
      }
    },
    [],
  )

  const getClassworkSubmissions = useCallback(async (classworkId) => {
    const data = await request(
      `/classwork/${encodeURIComponent(classworkId)}/submissions`,
    )
    return Array.isArray(data.submissions) ? data.submissions : []
  }, [])

  const submitClasswork = useCallback(
    async (classworkId, { text, file }) => {
      const formData = new FormData()
      formData.append('text', text || '')
      if (file) formData.append('file', file)
      const response = await fetch(
        apiUrl(`/api/learning/classwork/${encodeURIComponent(classworkId)}/submission`),
        { method: 'POST', headers: authHeaders(), body: formData },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.message || 'Could not turn in your work.')
      }
      await refresh({ silent: true })
      signalLearningChange()
      return data.submission
    },
    [refresh],
  )

  const gradeClassworkSubmission = useCallback(
    (classworkId, studentId, payload) =>
      mutate(
        `/classwork/${encodeURIComponent(classworkId)}/submissions/${encodeURIComponent(studentId)}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ),
    [mutate],
  )

  const downloadSubmissionFile = useCallback(
    async (submissionId, fileName) => {
      const response = await fetch(
        apiUrl(`/api/learning/submissions/${encodeURIComponent(submissionId)}/file`),
        { headers: authHeaders() },
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Could not download the submission.')
      }
      const objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = fileName || 'student-submission'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    },
    [],
  )

  const uploadSlideFile = useCallback(
    async (slideId, file) => {
      const formData = new FormData()
      formData.append('presentation', file)
      const response = await fetch(
        apiUrl(`/api/learning/slides/${encodeURIComponent(slideId)}/presentation`),
        {
          method: 'POST',
          headers: authHeaders(),
          body: formData,
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.message || 'Could not upload the file.')
      }
      await refresh({ silent: true })
      signalLearningChange()
      return data.presentation
    },
    [refresh],
  )

  const downloadSlideFile = useCallback(async (slideId) => {
    const response = await fetch(
      apiUrl(`/api/learning/slides/${encodeURIComponent(slideId)}/presentation`),
      { headers: authHeaders() },
    )
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || 'Could not download the file.')
    }

    const slide = slides.find((item) => item.id === slideId)
    const presentation = slide?.content?.[0]?.presentation
    const fileName = presentation?.fileName || 'lesson-file'
    const objectUrl = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }, [slides])

  const previewSlideFile = useCallback(async (slideId) => {
    const previewWindow = window.open('about:blank', '_blank')
    if (!previewWindow) {
      throw new Error('Allow pop-ups to preview this file.')
    }

    try {
      const response = await fetch(
        apiUrl(`/api/learning/slides/${encodeURIComponent(slideId)}/presentation?preview=1`),
        { headers: authHeaders() },
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Could not preview the file.')
      }

      const objectUrl = URL.createObjectURL(await response.blob())
      previewWindow.location.href = objectUrl
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    } catch (error) {
      previewWindow.close()
      throw error
    }
  }, [])

  const loadSlideFilePreview = useCallback(async (slideId) => {
    const response = await fetch(
      apiUrl(`/api/learning/slides/${encodeURIComponent(slideId)}/presentation?preview=1`),
      { headers: authHeaders() },
    )
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || 'Could not preview the lesson file.')
    }
    const blob = await response.blob()
    const slide = slides.find((item) => item.id === slideId)
    return {
      url: URL.createObjectURL(blob),
      blob,
      contentType: response.headers.get('Content-Type') || '',
      fileName: slide?.content?.[0]?.presentation?.fileName || 'lesson-file',
    }
  }, [slides])

  return {
    classes,
    quizzes,
    slides,
    students,
    classwork,
    quizAttempts,
    practiceQuizzes,
    activity,
    syncedAt,
    loading,
    error,
    refresh,
    createClass,
    updateClass,
    deleteClass,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    startQuizAttempt,
    submitQuizAttempt,
    generateLessonSummary,
    createPracticeQuiz,
    deletePracticeQuiz,
    startPracticeQuizAttempt,
    submitPracticeQuizAttempt,
    createSlide,
    updateSlide,
    deleteSlide,
    enrollClass,
    getStudentNotes,
    createStudentNote,
    updateStudentNote,
    deleteStudentNote,
    getClassStudents,
    getClassQuizAttempts,
    getClassAnnouncements,
    createClassAnnouncement,
    deleteClassAnnouncement,
    addAnnouncementComment,
    getClasswork,
    getClassPeople,
    createClasswork,
    deleteClasswork,
    uploadClassworkAttachment,
    downloadClassworkAttachment,
    previewClassworkAttachment,
    getClassworkSubmissions,
    submitClasswork,
    gradeClassworkSubmission,
    downloadSubmissionFile,
    uploadSlideFile,
    downloadSlideFile,
    previewSlideFile,
    loadSlideFilePreview,
  }
}
