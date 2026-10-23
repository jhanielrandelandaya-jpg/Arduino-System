import { useEffect, useState } from 'react'
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

function AuthVisual() {
  return (
    <section className="auth-visual">
      <div className="brand">
        <div className="brand-icon">L</div>
        <span>LearnSpace</span>
      </div>

      <div className="visual-content">
        <span className="eyebrow">YOUR LEARNING JOURNEY STARTS HERE</span>

        <h1>
          Learn better.
          <br />
          Achieve more.
        </h1>

        <p>
          Your subjects, lessons, notes, and quizzes in one organized
          learning space.
        </p>

        <div className="visual-card">
          <div className="book-icon">▤</div>
          <div>
            <strong>Your knowledge, your pace.</strong>
            <p>Study, practice, and track your progress.</p>
          </div>
        </div>
      </div>

      <div className="visual-footer">
        A smarter way to learn, one lesson at a time.
      </div>
    </section>
  )
}

function App() {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('Student')
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(() =>
    Boolean(getStoredToken()),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

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

  const switchMode = (loginMode) => {
    setIsLogin(loginMode)
    setError('')
    setShowPassword(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = {
      username: String(formData.get('username') || '').trim(),
      password: String(formData.get('password') || ''),
    }

    if (!isLogin) {
      payload.fullName = String(formData.get('fullName') || '').trim()
      payload.role = String(formData.get('role') || 'Student')
    }

    const remember = formData.get('remember') === 'on'
    setIsSubmitting(true)

    try {
      const response = await fetch(
        `/api/auth/${isLogin ? 'login' : 'register'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong. Please try again.')
      }

      storeToken(data.token, isLogin ? remember : true)
      setUser(data.user)
      form.reset()
      setRole('Student')
      setShowPassword(false)
    } catch (submitError) {
      setError(
        submitError.message ||
          'We could not reach the server. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = () => {
    clearStoredToken()
    setUser(null)
    setIsLogin(true)
    setError('')
    setShowPassword(false)
  }

  if (checkingSession) {
    return (
      <main className="auth-loading">
        <div className="brand-icon">L</div>
        <p>Checking your session...</p>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <AuthVisual />

      <section className="auth-panel">
        <div className="mobile-brand">
          <div className="brand-icon">L</div>
          <span>LearnSpace</span>
        </div>

        <div className="auth-container">
          {user ? (
            <>
              <div className="auth-heading">
                <span className="welcome-label">SIGNED IN</span>
                <h2>Welcome back, {user.fullName.split(' ')[0]}!</h2>
                <p>Your account is ready. Pick up where you left off.</p>
              </div>

              <div className="account-details">
                <div className="account-row">
                  <span>Full name</span>
                  <strong>{user.fullName}</strong>
                </div>
                <div className="account-row">
                  <span>Username or email</span>
                  <strong>{user.username}</strong>
                </div>
                <div className="account-row">
                  <span>Account type</span>
                  <strong>{user.role}</strong>
                </div>
              </div>

              <button
                type="button"
                className="submit-button"
                onClick={handleLogout}
              >
                Sign out
                <span>→</span>
              </button>

              <p className="auth-disclaimer">
                You are signed in. Sign out when you are finished on this
                device.
              </p>
            </>
          ) : (
            <>
              <div className="auth-heading">
                <span className="welcome-label">
                  {isLogin ? 'WELCOME BACK' : 'JOIN LEARNSPACE'}
                </span>

                <h2>
                  {isLogin ? 'Sign in to your account' : 'Create your account'}
                </h2>

                <p>
                  {isLogin
                    ? 'Enter your credentials to continue learning.'
                    : 'Fill in your details to get started.'}
                </p>
              </div>

              <div className="auth-tabs">
                <button
                  type="button"
                  className={isLogin ? 'tab active' : 'tab'}
                  onClick={() => switchMode(true)}
                >
                  Sign In
                </button>

                <button
                  type="button"
                  className={!isLogin ? 'tab active' : 'tab'}
                  onClick={() => switchMode(false)}
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="form-alert" role="alert">
                    {error}
                  </div>
                )}

                {!isLogin && (
                  <div className="form-group">
                    <label htmlFor="fullName">Full name</label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      autoComplete="name"
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="username">Username or email</label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Enter your username or email"
                    autoComplete="username"
                    required
                  />
                </div>

                {!isLogin && (
                  <div className="form-group">
                    <label htmlFor="role">Account type</label>
                    <select
                      id="role"
                      name="role"
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                    >
                      <option value="Student">Student</option>
                      <option value="Faculty">Faculty</option>
                    </select>
                    <small>Choose the role you are registering for.</small>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="password">Password</label>

                  <div className="password-field">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete={
                        isLogin ? 'current-password' : 'new-password'
                      }
                      minLength={8}
                      required
                    />

                    <button
                      type="button"
                      className="show-password"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {!isLogin && (
                    <small>Password must be at least 8 characters.</small>
                  )}
                </div>

                {isLogin && (
                  <div className="form-options">
                    <label className="remember-option">
                      <input type="checkbox" name="remember" />
                      <span>Remember me</span>
                    </label>

                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        alert('Password recovery will be added later.')
                      }
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  className="submit-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? isLogin
                      ? 'Signing in...'
                      : 'Creating account...'
                    : isLogin
                      ? 'Sign In'
                      : 'Create Account'}
                  {!isSubmitting && <span>→</span>}
                </button>
              </form>

              <p className="switch-prompt">
                {isLogin
                  ? "Don't have an account?"
                  : 'Already have an account?'}{' '}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => switchMode(!isLogin)}
                >
                  {isLogin ? 'Register now' : 'Sign in'}
                </button>
              </p>

              <p className="auth-disclaimer">
                By continuing, you agree to use LearnSpace responsibly and
                follow your institution's learning policies.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
