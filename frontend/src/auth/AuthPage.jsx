import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'

function AuthVisual() {
  return (
    <section className="auth-visual">
      <div className="brand auth-brand">
        <div className="brand-icon">L</div>
        <span>LearnSpace</span>
        <span className="brand-pill">LMS</span>
      </div>

      <div className="visual-content">
        <span className="eyebrow">ROLE-BASED LEARNING PLATFORM</span>

        <h1>
          Learn better.
          <br />
          Achieve more.
        </h1>

        <p>
          One platform for students and faculty, with dedicated workspaces
          for learning, teaching, and measurable progress.
        </p>

        <div className="visual-features">
          <div className="visual-feature">
            <span className="visual-feature-icon">
              <Icon name="graduation" size={19} />
            </span>
            <div>
              <strong>Student workspace</strong>
              <span>Lessons, notes, quizzes, and progress rules.</span>
            </div>
          </div>
          <div className="visual-feature">
            <span className="visual-feature-icon visual-feature-faculty">
              <Icon name="users" size={19} />
            </span>
            <div>
              <strong>Faculty workspace</strong>
              <span>Subjects, content, assessments, and reports.</span>
            </div>
          </div>
        </div>

        <div className="visual-card">
          <div className="book-icon">▤</div>
          <div>
            <strong>Your knowledge, your pace.</strong>
            <p>
              Role-aware access keeps every workspace focused and secure.
            </p>
          </div>
        </div>
      </div>

      <div className="visual-footer">
        <span>A smarter way to learn, one lesson at a time.</span>
        <span className="visual-security">
          <Icon name="shield" size={14} />
          Protected role-based access
        </span>
      </div>
    </section>
  )
}

const roleOptions = [
  {
    value: 'Student',
    title: 'Student',
    description: 'Learn lessons, take quizzes, and track progress.',
    icon: 'graduation',
  },
  {
    value: 'Faculty',
    title: 'Faculty',
    description: 'Manage subjects, publish lessons, and review results.',
    icon: 'users',
  },
]

const getPasswordStrength = (password) => {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length

  if (!password) return { score: 0, label: '' }
  if (score <= 1) return { score: 1, label: 'Weak' }
  if (score === 2) return { score: 2, label: 'Fair' }
  if (score === 3) return { score: 3, label: 'Good' }
  return { score: 4, label: 'Strong' }
}

function AuthPage({ mode, onAuthenticated }) {
  const navigate = useNavigate()
  const isLogin = mode === 'login'
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('Student')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const strength = getPasswordStrength(password)

  const switchMode = (nextMode) => {
    setError('')
    setShowPassword(false)
    setPassword('')
    navigate(nextMode === 'login' ? '/login' : '/register')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const payload = {
      username: username.trim(),
      password,
    }

    if (!isLogin) {
      payload.fullName = fullName.trim()
      payload.role = role
    }

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
        throw new Error(
          data.message || 'Something went wrong. Please try again.',
        )
      }

      if (!data.token || !data.user) {
        throw new Error(
          'Your account was saved, but the session could not be started.',
        )
      }

      onAuthenticated(data, isLogin ? remember : true)
    } catch (submitError) {
      setError(
        submitError.message ||
          'We could not reach the server. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
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
          <div className="auth-heading">
            <span className="welcome-label">
              {isLogin ? 'WELCOME BACK' : 'JOIN LEARNSPACE'}
            </span>

            <h2>
              {isLogin ? 'Sign in to your account' : 'Create your account'}
            </h2>

            <p>
              {isLogin
                ? 'Enter your credentials and we will open the right dashboard for your role.'
                : 'Choose your role and get a workspace built for how you learn or teach.'}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={isLogin ? 'tab active' : 'tab'}
              onClick={() => switchMode('login')}
            >
              Sign In
            </button>

            <button
              type="button"
              className={!isLogin ? 'tab active' : 'tab'}
              onClick={() => switchMode('register')}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="form-alert" role="alert">
                <Icon name="alert" size={16} />
                <span>{error}</span>
              </div>
            )}

            {!isLogin && (
              <div className="form-group">
                <label htmlFor="fullName">Full name</label>
                <div className="input-icon-wrap">
                  <Icon name="user" size={16} />
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Username or email</label>
              <div className="input-icon-wrap">
                <Icon name="mail" size={16} />
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Enter your username or email"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {!isLogin && (
              <div className="form-group">
                <span className="form-label">Account type</span>
                <div className="role-selector">
                  {roleOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`role-option ${role === option.value ? 'is-active' : ''}`}
                      onClick={() => setRole(option.value)}
                      aria-pressed={role === option.value}
                    >
                      <span className="role-option-icon">
                        <Icon name={option.icon} size={18} />
                      </span>
                      <span className="role-option-copy">
                        <strong>{option.title}</strong>
                        <small>{option.description}</small>
                      </span>
                      <span className="role-option-check">
                        {role === option.value && <Icon name="check" size={12} />}
                      </span>
                    </button>
                  ))}
                </div>
                <small>
                  Your role determines which dashboard and permissions you get.
                </small>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password">Password</label>

              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="show-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              {!isLogin && (
                <div className="password-strength">
                  <div className="strength-bars" aria-hidden="true">
                    {[1, 2, 3, 4].map((level) => (
                      <span
                        key={level}
                        className={strength.score >= level ? 'is-filled' : ''}
                      />
                    ))}
                  </div>
                  <div className="strength-meta">
                    <span>
                      {strength.label
                        ? `Password strength: ${strength.label}`
                        : 'Use 8+ characters with numbers and symbols.'}
                    </span>
                    <span>{password.length}/8+</span>
                  </div>
                </div>
              )}
            </div>

            {isLogin && (
              <div className="form-options">
                <label className="remember-option">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  <span>Remember me on this device</span>
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
                  : 'Creating your workspace...'
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
              onClick={() => switchMode(isLogin ? 'register' : 'login')}
            >
              {isLogin ? 'Register now' : 'Sign in'}
            </button>
          </p>

          <div className="auth-trust">
            <span>
              <Icon name="shield" size={14} />
              Secure role-based access
            </span>
            <span>
              <Icon name="checkCircle" size={14} />
              Session stays signed in after refresh
            </span>
          </div>

          <p className="auth-disclaimer">
            By continuing, you agree to use LearnSpace responsibly and follow
            your institution's learning policies.
          </p>
        </div>
      </section>
    </main>
  )
}

export default AuthPage
