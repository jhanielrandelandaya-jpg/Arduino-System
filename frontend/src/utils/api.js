import { apiUrl } from './apiUrl'

const TOKEN_KEY = 'learnspace_token'

export const getAuthToken = () => {
  try {
    return (
      window.localStorage.getItem(TOKEN_KEY) ||
      window.sessionStorage.getItem(TOKEN_KEY)
    )
  } catch {
    return null
  }
}

export const apiRequest = async (path, options = {}) => {
  const token = getAuthToken()
  const response = await fetch(apiUrl(`/api${path}`), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'The request failed. Please try again.')
  }

  return data
}
