import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
import { apiRequest } from '../utils/api.js'

const formatRelativeTime = (value) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Recently'
  }

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const toneFor = (item) => {
  if (item.type === 'class') return 'blue'
  if (item.type === 'quiz') return 'violet'
  return 'amber'
}

const iconFor = (item) => {
  if (item.type === 'class') return 'book'
  if (item.type === 'quiz') return 'quiz'
  return 'clock'
}

function NotificationMenu({ role }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [marking, setMarking] = useState(false)
  const rootRef = useRef(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true)
    }

    try {
      const data = await apiRequest('/notifications')
      setNotifications(
        Array.isArray(data.notifications) ? data.notifications : [],
      )
      setUnreadCount(Number(data.unreadCount) || 0)
      setError('')
    } catch (loadError) {
      if (!silent) {
        setError(loadError.message)
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => load(), 0)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load({ silent: true })
      }
    }, 30000)

    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
  }, [load])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const markAllRead = async () => {
    setMarking(true)

    try {
      await apiRequest('/notifications/read', { method: 'POST' })
      setNotifications((current) =>
        current.map((item) => ({ ...item, read: true })),
      )
      setUnreadCount(0)
    } catch {
      // Keep the unread state if the request fails.
    } finally {
      setMarking(false)
    }
  }

  const openNotification = (item) => {
    setOpen(false)

    if (!item.read) {
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, read: true })),
      )
      setUnreadCount(0)
      apiRequest('/notifications/read', { method: 'POST' }).catch(() => {})
    }

    if (item.path) {
      navigate(item.path)
    }
  }

  const toggleOpen = () => {
    const next = !open
    setOpen(next)

    if (next) {
      load({ silent: true })
    }
  }

  return (
    <div className="lms-notification-wrap" ref={rootRef}>
      <button
        type="button"
        className={`lms-icon-btn lms-notification ${open ? 'is-open' : ''}`}
        aria-label={`Notifications${
          unreadCount > 0 ? ` (${unreadCount} unread)` : ''
        }`}
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <Icon name="bell" size={19} />
        {unreadCount > 0 && (
          <span className="lms-notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="lms-notification-panel"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="lms-notification-head">
            <div>
              <strong>Notifications</strong>
              <span>
                {unreadCount > 0
                  ? `${unreadCount} unread update${
                      unreadCount === 1 ? '' : 's'
                    }`
                  : 'You are all caught up'}
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="lms-notification-read"
                onClick={markAllRead}
                disabled={marking}
              >
                {marking ? 'Marking...' : 'Mark all read'}
              </button>
            )}
          </div>

          <div className="lms-notification-list">
            {loading ? (
              <div className="lms-notification-status">
                <span className="lms-search-spinner" />
                Loading notifications...
              </div>
            ) : error && notifications.length === 0 ? (
              <div className="lms-notification-empty">
                <span className="lms-notification-empty-icon">
                  <Icon name="alert" size={20} />
                </span>
                <strong>Could not load notifications</strong>
                <span>{error}</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="lms-notification-empty">
                <span className="lms-notification-empty-icon">
                  <Icon name="bell" size={20} />
                </span>
                <strong>No notifications yet</strong>
                <span>
                  {role === 'Faculty'
                    ? 'Class, quiz, and draft reminders will appear here.'
                    : 'Class and quiz updates will appear here.'}
                </span>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  type="button"
                  className={`lms-notification-item ${
                    item.read ? '' : 'is-unread'
                  }`}
                  key={item.id}
                  onClick={() => openNotification(item)}
                >
                  <span
                    className={`lms-notification-icon lms-tone-${toneFor(
                      item,
                    )}`}
                  >
                    <Icon name={iconFor(item)} size={16} />
                  </span>
                  <span className="lms-notification-copy">
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <time>{formatRelativeTime(item.createdAt)}</time>
                  </span>
                  {!item.read && <span className="lms-notification-unread" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationMenu
