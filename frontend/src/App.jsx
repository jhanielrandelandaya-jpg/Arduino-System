import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import AuthPage from './auth/AuthPage.jsx'
import StudentDashboard from './dashboard/StudentDashboard.jsx'
import FacultyDashboard from './dashboard/FacultyDashboard.jsx'
import './App.css'

const TOKEN_KEY = 'learnspace_token'

const getStoredToken = () => {
  try {
    return (
      window.localStorage.getItem(TOKEN_KEY) ||
      window.sessionStorage.getItem(TOKEN_KEY)
    )
  } catch {
    return null
  }
}

const storeToken = (token, remember) => {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
    window.sessionStorage.removeItem(TOKEN_KEY)
    const storage = remember ? window.localStorage : window.sessionStorage
    storage.setItem(TOKEN_KEY, token)
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

const clearStoredToken = () => {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
    window.sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Ignore storage errors.
  }
}

const getDashboardPath = (user) =>
  user?.role === 'Faculty' ? '/faculty/dashboard' : '/student/dashboard'

function ProtectedRoute({ user, role, children }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== role) {
    return <Navigate to={getDashboardPath(user)} replace />
  }

  return children
}

function App() {
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(() =>
    Boolean(getStoredToken()),
  )

  useEffect(() => {
    const token = getStoredToken()

    if (!token) {
      return undefined
    }

    let cancelled = false

    const loadSession = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.message || 'Session expired.')
        }

        if (!cancelled) {
          setUser(data.user)
        }
      } catch {
        clearStoredToken()
      } finally {
        if (!cancelled) {
          setCheckingSession(false)
        }
      }
    }

    loadSession()

    return () => {
      cancelled = true
    }
  }, [])

  const handleAuthenticated = (data, remember) => {
    storeToken(data.token, remember)
    setUser(data.user)
  }

  const handleLogout = () => {
    clearStoredToken()
    setUser(null)
  }

  if (checkingSession) {
    return (
      <main className="auth-loading">
        <div className="brand-icon">L</div>
        <p>Restoring your LearnSpace session...</p>
      </main>
    )
  }

  const dashboardPath = user ? getDashboardPath(user) : '/login'

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={dashboardPath} replace />}
        />
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={dashboardPath} replace />
            ) : (
              <AuthPage mode="login" onAuthenticated={handleAuthenticated} />
            )
          }
        />
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to={dashboardPath} replace />
            ) : (
              <AuthPage mode="register" onAuthenticated={handleAuthenticated} />
            )
          }
        />
        <Route
          path="/student/*"
          element={
            <ProtectedRoute user={user} role="Student">
              <StudentDashboard user={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/*"
          element={
            <ProtectedRoute user={user} role="Faculty">
              <FacultyDashboard user={user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={dashboardPath} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
