export default function AuthTabs({ active, onSwitch }) {
  return (
    <div className="auth-tabs">
      <button
        type="button"
        className={`tab ${active === 'login' ? 'is-active' : ''}`}
        onClick={() => onSwitch('login')}
        aria-pressed={active === 'login'}
      >
        Sign In
      </button>
      <button
        type="button"
        className={`tab ${active === 'register' ? 'is-active' : ''}`}
        onClick={() => onSwitch('register')}
        aria-pressed={active === 'register'}
      >
        Register
      </button>
    </div>
  )
}
