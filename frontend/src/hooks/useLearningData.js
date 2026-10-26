import { useCallback, useEffect, useRef, useState } from 'react'

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

const request = async (path, options = {}) => {
  const token = getToken()
  const response = await fetch(`/api/learning${path}`, {
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

export function useLearningData({ pollInterval = 3000 } = {}) {
  const [classes, setClasses] = useState([])
  const [quizzes, setQuizzes] = useState([])
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
      const data = await request('/bootstrap')

      if (!mounted.current || requestId.current !== currentRequest) {
        return data
      }

      setClasses(Array.isArray(data.classes) ? data.classes : [])
      setQuizzes(Array.isArray(data.quizzes) ? data.quizzes : [])
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
  }, [])

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

  return {
    classes,
    quizzes,
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
  }
}
