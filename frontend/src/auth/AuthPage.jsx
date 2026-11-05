import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { apiUrl } from '../utils/apiUrl'

const departmentOptions = [
  {
    value: 'BSAD',
    title: 'BSAD',
    description: 'Bachelor of Science in Agricultural Development',
    courses: [
      { value: 'BTVTEICT-ET', title: 'BTVTEICT-ET - Bachelor of Technical-Vocational Teacher Education major in Electrical Technology' },
      { value: 'BTVTEICT-ELXT', title: 'BTVTEICT-ELXT - Bachelor of Technical-Vocational Teacher Education major in Electronics Technology' },
      { value: 'BTVTEICT-ICT-CH', title: 'BTVTEICT-ICT-CH - Bachelor of Technical-Vocational Teacher Education major in ICT - Computer Hardware Servicing' },
      { value: 'BTVTEICT-ICT-CP', title: 'BTVTEICT-ICT-CP - Bachelor of Technical-Vocational Teacher Education major in ICT - Computer Programming' },
    ],
  },
  {
    value: 'EAAD',
    title: 'EAAD',
    description: 'Engineering and Applied Arts Department',
    courses: [
      { value: 'BSEE', title: 'BSEE - Bachelor of Science in Electrical Engineering' },
      { value: 'BSEcE', title: 'BSEcE - Bachelor of Science in Electronics Engineering' },
      { value: 'BSIT', title: 'BSIT - Bachelor of Science in Information Technology' },
      { value: 'BETET', title: 'BETET - Bachelor of Engineering Technology major in Electrical Technology' },
      { value: 'BETELXT', title: 'BETELXT - Bachelor of Engineering Technology major in Electronics Technology' },
      { value: 'BETICT', title: 'BETICT - Bachelor of Engineering Technology major in Instrumentation & Controls Technology' },
      { value: 'BETMECT', title: 'BETMECT - Bachelor of Engineering Technology major in Mechatronics Technology' },
    ],
  },
  {
    value: 'MAAD',
    title: 'MAAD',
    description: 'Mechanical and Allied Arts Department',
    courses: [
      { value: 'BSME', title: 'BSME - Bachelor of Science in Mechanical Engineering' },
      { value: 'BETAT', title: 'BETAT - Bachelor of Engineering Technology major in Automotive Technology' },
      { value: 'BETDMT', title: 'BETDMT - Bachelor of Engineering Technology major in Dies & Moulds Technology' },
      { value: 'BETEMT', title: 'BETEMT - Bachelor of Engineering Technology major in Electromechanical Technology' },
      { value: 'BETHVAC/RT', title: 'BETHVAC/RT - Bachelor of Engineering Technology major in Heating, Ventilation, & Airconditioning / Refrigeration Technology' },
      { value: 'BETMT', title: 'BETMT - Bachelor of Engineering Technology major in Mechanical Technology' },
      { value: 'BETNDT', title: 'BETNDT - Bachelor of Engineering Technology major in Non-Destructive Testing Technology' },
    ],
  },
  {
    value: 'CAAD',
    title: 'CAAD',
    description: 'Civil and Allied Arts Department',
    courses: [
      { value: 'BSCE', title: 'BSCE - Bachelor of Science in Civil Engineering' },
      { value: 'BSES', title: 'BSES - Bachelor of Science in Environmental Science' },
      { value: 'BETCHT', title: 'BETCHT - Bachelor of Engineering Technology major in Chemical Technology' },
      { value: 'BETCT', title: 'BETCT - Bachelor of Engineering Technology major in Civil Technology' },
    ],
  },
]

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

function AuthBrand() {
  return (
    <section className="auth-brand-panel">
      <div className="auth-decoration auth-decoration-1" />
      <div className="auth-decoration auth-decoration-2" />
      <div className="brand-wrapper">
        <div className="brand-header">
          <div className="brand-mark">L</div>
          <span className="brand-name">LearnSpace</span>
          <span className="brand-pill">LMS</span>
        </div>
        <div className="brand-body">
          <span className="eyebrow">ROLE-BASED LEARNING PLATFORM</span>
          <h1 className="brand-heading">
            Learn better.<br />
            <span className="gradient-text">Achieve more.</span>
          </h1>
          <p className="brand-desc">
            One platform for students and faculty, with dedicated workspaces
            for learning, teaching, and measurable progress.
          </p>
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Icon name="graduation" size={20} />
              </div>
              <div>
                <strong>Student Workspace</strong>
                <span>Lessons, notes, quizzes, and progress tracking.</span>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Icon name="users" size={20} />
              </div>
              <div>
                <strong>Faculty Workspace</strong>
                <span>Create, manage, and track learning activities.</span>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Icon name="shield" size={20} />
              </div>
              <div>
                <strong>Your Knowledge, Your Pace.</strong>
                <span>Learn anytime, anywhere, with secure access.</span>
              </div>
            </div>
          </div>
        </div>
        <div className="brand-footer">
          <span>A smarter way to learn, one lesson at a time.</span>
        </div>
      </div>
    </section>
  )
}

function AuthPage({ mode, onAuthenticated }) {
  const navigate = useNavigate()
  const isLogin = mode === 'login'
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('Student')
  const [department, setDepartment] = useState('')
  const [course, setCourse] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)

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
      payload.department = department
      if (role === 'Student') {
        payload.course = course
      }
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(
        apiUrl(`/api/auth/${isLogin ? 'login' : 'register'}`),
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

  const handleForgotPassword = () => {
    alert('Password recovery will be added later.')
  }

  const handleSocial = (provider) => {
    alert(`${provider} sign-in will be added later.`)
  }

  return (
    <main className="auth-page">
      <AuthBrand />

      <section className="auth-form-panel">
        <div className="form-scroll">
          <div className="form-header">
            <div className="form-brand">
              <div className="brand-mark">L</div>
              <span className="brand-name">LearnSpace</span>
            </div>
          </div>

          <h2 className="form-title">Welcome Back!</h2>
          <p className="form-subtitle">
            Sign in to continue your learning journey.
          </p>

          <div className="auth-tabs">
            <button
              type="button"
              className={`tab ${isLogin ? 'is-active' : ''}`}
              onClick={() => switchMode('login')}
              aria-pressed={isLogin}
            >
              <span className="tab-label">Sign In</span>
              <span className="tab-indicator" />
            </button>
            <button
              type="button"
              className={`tab ${!isLogin ? 'is-active' : ''}`}
              onClick={() => switchMode('register')}
              aria-pressed={!isLogin}
            >
              <span className="tab-label">Register</span>
              <span className="tab-indicator" />
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="form-alert" role="alert">
                <Icon name="alert" size={16} />
                <span>{error}</span>
              </div>
            )}

            {!isLogin && (
              <>
                <div className="form-group">
                  <label className="form-label">Full name</label>
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

                <div className="form-group">
                  <label className="form-label">Username or email</label>
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

                <div className="form-group">
                  <label className="form-label">Department</label>
                  <div className="input-icon-wrap">
                    <Icon name="more" size={16} />
                    <select
                      id="department"
                      value={department}
                      onChange={(event) => {
                        setDepartment(event.target.value)
                        setCourse('')
                      }}
                      required
                    >
                      <option value="">Select a department</option>
                      {departmentOptions.map((departmentOption) => (
                        <option
                          key={departmentOption.value}
                          value={departmentOption.value}
                        >
                          {departmentOption.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <small className="field-hint">
                    Pick your department first. Your courses will appear once a
                    department is selected.
                  </small>
                </div>

                {role === 'Student' && department && (
                  <div className="form-group">
                    <label className="form-label">Course</label>
                    <div className="input-icon-wrap">
                      <Icon name="more" size={16} />
                      <select
                        id="course"
                        value={course}
                        onChange={(event) => setCourse(event.target.value)}
                        required
                      >
                        <option value="">Select a course</option>
                        {departmentOptions
                          .find((item) => item.value === department)
                          ?.courses.map((courseOption) => (
                            <option
                              key={courseOption.value}
                              value={courseOption.value}
                            >
                              {courseOption.title}
                            </option>
                          ))}
                      </select>
                    </div>
                    <small className="field-hint">
                      Your course determines your subject offerings and class
                      placement.
                    </small>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Account type</label>
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
                  <small className="field-hint">
                    Your role determines which dashboard and permissions you get.
                  </small>
                </div>
              </>
            )}

            {(isLogin ? (
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-icon-wrap">
                  <Icon name="mail" size={16} />
                  <input
                    id="username"
                    name="username"
                    type="email"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Enter your email address"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>
            ) : null)}

            <div className="form-group">
              <label className="form-label">Password</label>
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
                        className={
                          password.length >= level * 2 ? 'is-filled' : ''
                        }
                      />
                    ))}
                  </div>
                  <div className="strength-meta">
                    <span>{password.length > 0 ? `Password strength` : 'Use 8+ characters with numbers and symbols.'}</span>
                    <span>{password.length}/8+</span>
                  </div>
                </div>
              )}
            </div>

            {isLogin && (
              <div className="form-actions">
                <label className="remember-option">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-button"
                  onClick={handleForgotPassword}
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
              {!isSubmitting && <span className="arrow">→</span>}
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

          <div className="social-divider">
            <span>or continue with</span>
          </div>
          <div className="social-buttons">
            <button
              type="button"
              className="social-btn social-google"
              onClick={() => handleSocial('Google')}
              aria-label="Sign in with Google"
            >
              Google
            </button>
            <button
              type="button"
              className="social-btn social-microsoft"
              onClick={() => handleSocial('Microsoft')}
              aria-label="Sign in with Microsoft"
            >
              Microsoft
            </button>
            <button
              type="button"
              className="social-btn social-apple"
              onClick={() => handleSocial('Apple')}
              aria-label="Sign in with Apple"
            >
              Apple
            </button>
          </div>

          <div className="security-badge">
            <Icon name="shield" size={14} />
            <span>
              <strong>Your data is safe with us.</strong>
              <br />
              We follow industry-standard security practices.
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}

export default AuthPage
