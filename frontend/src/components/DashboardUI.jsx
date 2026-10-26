import { useEffect } from 'react'
import Icon from './Icon.jsx'

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="lms-page-head">
      <div>
        {eyebrow && <span className="lms-page-eyebrow">{eyebrow}</span>}
        <h1 className="lms-page-title">{title}</h1>
        {description && <p className="lms-page-description">{description}</p>}
      </div>
      {actions && <div className="lms-page-actions">{actions}</div>}
    </header>
  )
}

export function SectionHeader({ title, description, action }) {
  return (
    <div className="lms-section-head">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, meta, icon, tone = 'blue', trend }) {
  return (
    <article className="lms-stat-card">
      <div className={`lms-stat-icon lms-tone-${tone}`}>
        <Icon name={icon} size={21} />
      </div>
      <div className="lms-stat-body">
        <span className="lms-stat-label">{label}</span>
        <strong className="lms-stat-value">{value}</strong>
        <span className="lms-stat-meta">
          {trend && (
            <span className={`lms-stat-trend lms-trend-${trend.direction}`}>
              <Icon
                name={trend.direction === 'down' ? 'arrowDown' : 'arrowUp'}
                size={12}
              />
              {trend.value}
            </span>
          )}
          {meta}
        </span>
      </div>
    </article>
  )
}

export function ProgressBar({ value, tone = 'blue', label }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0))

  return (
    <div className="lms-progress-wrap">
      {label && (
        <div className="lms-progress-label">
          <span>{label}</span>
          <strong>{safeValue}%</strong>
        </div>
      )}
      <div
        className="lms-progress-track"
        role="progressbar"
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className={`lms-progress-fill lms-fill-${tone}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  )
}

export function ProgressRing({ value, size = 108, label }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0))

  return (
    <div
      className="lms-ring"
      style={{ '--ring-value': `${safeValue}%`, '--ring-size': `${size}px` }}
      role="img"
      aria-label={`${label || 'Progress'}: ${safeValue}%`}
    >
      <div className="lms-ring-inner">
        <strong>{safeValue}%</strong>
        {label && <span>{label}</span>}
      </div>
    </div>
  )
}

export function MetricRing({ value, display, label, tone = 'blue', size = 74 }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0))

  return (
    <div
      className={`lms-metric-ring lms-metric-${tone}`}
      style={{
        '--metric-value': `${safeValue}%`,
        '--metric-size': `${size}px`,
      }}
      role="img"
      aria-label={`${label}: ${display}`}
    >
      <div className="lms-metric-inner">
        <strong>{display}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

export function DonutChart({
  segments,
  size = 144,
  centerValue,
  centerLabel,
  label = 'Learning progress',
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1
  const stops = segments
    .map((segment, index) => {
      const start =
        (segments
          .slice(0, index)
          .reduce((sum, item) => sum + item.value, 0) /
          total) *
        100
      const end = start + (segment.value / total) * 100
      return `${segment.color} ${start}% ${end}%`
    })
    .join(', ')

  return (
    <div
      className="lms-donut"
      style={{
        '--donut-size': `${size}px`,
        background: `conic-gradient(${stops})`,
      }}
      role="img"
      aria-label={`${label}: ${centerValue}`}
    >
      <div className="lms-donut-inner">
        <strong>{centerValue}</strong>
        {centerLabel && <span>{centerLabel}</span>}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'neutral', dot = false }) {
  return (
    <span className={`lms-badge lms-badge-${tone}`}>
      {dot && <span className="lms-badge-dot" />}
      {children}
    </span>
  )
}

export function Avatar({ name = '', size = 'md', tone = 'blue' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <span className={`lms-avatar lms-avatar-${size} lms-tone-${tone}`}>
      {initials || '?'}
    </span>
  )
}

export function EmptyState({ icon = 'search', title, description, action }) {
  return (
    <div className="lms-empty">
      <span className="lms-empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

export function Modal({ title, description, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('lms-modal-open')

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('lms-modal-open')
    }
  }, [onClose])

  return (
    <div className="lms-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className={`lms-modal lms-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lms-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="lms-modal-head">
          <div>
            <h2 id="lms-modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="lms-icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="lms-modal-body">{children}</div>
        {footer && <div className="lms-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children, className = '', style }) {
  return (
    <label className={`lms-field ${className}`} style={style}>
      <span className="lms-field-label">{label}</span>
      {children}
      {hint && <span className="lms-field-hint">{hint}</span>}
    </label>
  )
}
