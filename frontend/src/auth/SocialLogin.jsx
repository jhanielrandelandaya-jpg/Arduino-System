const SOCIALS = [
  { id: 'google', label: 'Google', className: 'social-google', iconColor: '#fbbc04', initial: 'G' },
  { id: 'microsoft', label: 'Microsoft', className: 'social-microsoft', iconColor: '#00a4ef', initial: 'M' },
  { id: 'apple', label: 'Apple', className: 'social-apple', iconColor: '#000000', initial: 'A' },
]

export default function SocialLogin({ onSocial }) {
  return (
    <>
      <div className="social-divider">
        <span>or continue with</span>
      </div>
      <div className="social-buttons">
        {SOCIALS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`social-btn ${item.className}`}
            onClick={() => onSocial(item.id)}
            aria-label={`Sign in with ${item.label}`}
          >
            <span className="social-icon">
              {item.initial}
            </span>
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
