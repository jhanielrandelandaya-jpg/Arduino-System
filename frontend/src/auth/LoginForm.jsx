import Icon from '../components/Icon.jsx'
import AuthTabs from './AuthTabs.jsx'

export default function LoginForm({
  mode,
  onSwitch,
  error,
  isSubmitting,
  fullName,
  setFullName,
  username,
  setUsername,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  remember,
  setRemember,
  securityPolicyAccepted,
  setSecurityPolicyAccepted,
  role,
  setRole,
  department,
  setDepartment,
  course,
  setCourse,
  departmentOptions,
  roleOptions,
  onSubmit,
  onForgotPassword,
}) {
  const isLogin = mode === 'login'

  return (
    <section className="form-panel">
      <div className="form-decoration" />
      <div className="form-scroll">
        <div className="form-content">
          <div className="form-header">
            <div className="form-brand">
              <div className="brand-mark">L</div>
              <span className="brand-name">LearnSpace</span>
            </div>
          </div>

          <h2 className="form-title">
            {isLogin ? 'Welcome Back!' : 'Create your account'}
          </h2>
          <p className="form-subtitle">
            {isLogin
              ? 'Sign in to continue your learning journey.'
              : 'Choose your role and get a workspace built for how you learn or teach.'}
          </p>

          <AuthTabs active={mode} onSwitch={onSwitch} />

          <form onSubmit={onSubmit} noValidate>
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
                        className={password.length >= level * 2 ? 'is-filled' : ''}
                      />
                    ))}
                  </div>
                  <div className="strength-meta">
                    <span>
                      {password.length > 0
                        ? 'Password strength'
                        : 'Use 8+ characters with numbers and symbols.'}
                    </span>
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
                  onClick={onForgotPassword}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {!isLogin && (
              <div className="security-policy">
                <details>
                  <summary>Read the Security Policy</summary>
                  <div className="security-policy-content">
                    <p>
                      Keep your account secure by using a strong, unique
                      password and never sharing your password or sign-in
                      details with anyone.
                    </p>
                    <p>
                      Sign out when using a shared device, keep your device and
                      browser up to date, and contact your school administrator
                      promptly if you suspect someone accessed your account.
                    </p>
                    <p>
                      LearnSpace staff will not ask you to disclose your
                      password. Protect your account information and report
                      suspicious messages or activity.
                    </p>
                  </div>
                </details>
                <label className="security-policy-accept">
                  <input
                    type="checkbox"
                    name="securityPolicyAccepted"
                    checked={securityPolicyAccepted}
                    onChange={(event) =>
                      setSecurityPolicyAccepted(event.target.checked)
                    }
                    required
                  />
                  <span>I have read and agree to follow the Security Policy.</span>
                </label>
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
              {!isSubmitting && <span className="arrow">&#8594;</span>}
            </button>
          </form>

          <p className="switch-prompt">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              className="text-button"
              onClick={() => onSwitch(isLogin ? 'register' : 'login')}
            >
              {isLogin ? 'Register now' : 'Sign in'}
            </button>
          </p>

          <div className="security-badge">
            <Icon name="shield" size={14} />
            <span>
              <strong>Your data is safe with us.</strong>
              <br />
              <small>We follow industry-standard security practices.</small>
            </span>
          </div>

          <div className="form-footer">
            By continuing, you agree to our{' '}
            <span style={{ color: '#0057ff', fontWeight: 600 }}>
              Terms of Service
            </span>{' '}
            and{' '}
            <span style={{ color: '#0057ff', fontWeight: 600 }}>
              Privacy Policy
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
