const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export const apiUrl = (path) =>
  `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`
