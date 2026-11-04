import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
import { apiRequest } from '../utils/api.js'

const quickLinks = {
  Faculty: [
    {
      label: 'Dashboard',
      subtitle: 'Workspace overview and activity',
      path: '/faculty/dashboard',
      icon: 'grid',
      tone: 'blue',
    },
    {
      label: 'My Classes',
      subtitle: 'Create and manage classes',
      path: '/faculty/subjects',
      icon: 'book',
      tone: 'blue',
    },
    {
      label: 'Lessons',
      subtitle: 'Publish lessons for students',
      path: '/faculty/lessons',
      icon: 'presentation',
      tone: 'teal',
    },
    {
      label: 'Presentation Studio',
      subtitle: 'Build and present slide decks',
      path: '/faculty/presentations',
      icon: 'layers',
      tone: 'violet',
    },
    {
      label: 'All Tests',
      subtitle: 'Create and grade quizzes',
      path: '/faculty/quizzes',
      icon: 'quiz',
      tone: 'violet',
    },
    {
      label: 'Tests Monitoring',
      subtitle: 'Review student performance',
      path: '/faculty/performance',
      icon: 'users',
      tone: 'amber',
    },
    {
      label: 'Reports',
      subtitle: 'Export class results',
      path: '/faculty/reports',
      icon: 'report',
      tone: 'green',
    },
    {
      label: 'Settings',
      subtitle: 'Profile, security, notifications',
      action: 'settings',
      icon: 'settings',
      tone: 'blue',
    },
    {
      label: 'Help Center',
      subtitle: 'FAQs and support',
      action: 'help',
      icon: 'help',
      tone: 'teal',
    },
  ],
  Student: [
    {
      label: 'Overview',
      subtitle: 'Your learning snapshot',
      path: '/student/dashboard',
      icon: 'grid',
      tone: 'blue',
    },
    {
      label: 'My Classes',
      subtitle: 'Browse enrolled classes',
      path: '/student/subjects',
      icon: 'book',
      tone: 'blue',
    },
    {
      label: 'Lessons',
      subtitle: 'Open class lessons',
      path: '/student/lessons',
      icon: 'presentation',
      tone: 'teal',
    },
    {
      label: 'My Notes',
      subtitle: 'Review your saved notes',
      path: '/student/notes',
      icon: 'notes',
      tone: 'amber',
    },
    {
      label: 'Quiz Results',
      subtitle: 'See scores and attempts',
      path: '/student/results',
      icon: 'chart',
      tone: 'green',
    },
    {
      label: 'Learning Progress',
      subtitle: 'Track your progress',
      path: '/student/progress',
      icon: 'trend',
      tone: 'teal',
    },
    {
      label: 'Settings',
      subtitle: 'Profile, security, notifications',
      action: 'settings',
      icon: 'settings',
      tone: 'blue',
    },
    {
      label: 'Help Center',
      subtitle: 'FAQs and support',
      action: 'help',
      icon: 'help',
      tone: 'teal',
    },
  ],
}

const typeLabels = {
  class: 'Class',
  quiz: 'Quiz',
  student: 'Student',
  link: 'Page',
}

function WorkspaceSearch({ role, onOpenSettings, onOpenHelp }) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const rootRef = useRef(null)
  const requestRef = useRef(0)

  const links = useMemo(() => {
    const query = term.trim().toLowerCase()
    const items = quickLinks[role] || []

    if (!query) {
      return items.slice(0, 6)
    }

    return items
      .filter((item) =>
        `${item.label} ${item.subtitle}`.toLowerCase().includes(query),
      )
      .slice(0, 4)
  }, [role, term])

  const suggestions = useMemo(
    () => [
      ...results.map((item) => ({ ...item, kind: 'result' })),
      ...links.map((item) => ({ ...item, kind: 'link' })),
    ],
    [links, results],
  )

  useEffect(() => {
    const query = term.trim()
    const requestId = requestRef.current + 1
    requestRef.current = requestId

    const timer = window.setTimeout(async () => {
      if (requestRef.current !== requestId) {
        return
      }

      setResults([])
      setActiveIndex(0)

      if (query.length < 2) {
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const data = await apiRequest(`/search?q=${encodeURIComponent(query)}`)
        if (requestRef.current === requestId) {
          setResults(Array.isArray(data.results) ? data.results : [])
        }
      } catch {
        if (requestRef.current === requestId) {
          setResults([])
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false)
        }
      }
    }, query.length < 2 ? 0 : 220)

    return () => window.clearTimeout(timer)
  }, [term])

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

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const selectSuggestion = (item) => {
    setOpen(false)
    setTerm('')
    inputRef.current?.blur()

    if (item.action === 'settings') {
      onOpenSettings()
      return
    }

    if (item.action === 'help') {
      onOpenHelp()
      return
    }

    const target = item.query
      ? `${item.path}?q=${encodeURIComponent(item.query)}`
      : item.path

    navigate(target)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) =>
        suggestions.length > 0
          ? (current + 1) % suggestions.length
          : 0,
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) =>
        suggestions.length > 0
          ? (current - 1 + suggestions.length) % suggestions.length
          : 0,
      )
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (suggestions[activeIndex]) {
        selectSuggestion(suggestions[activeIndex])
      }
      return
    }

    if (event.key === 'Escape') {
      setOpen(false)
      setTerm('')
    }
  }

  const showEmpty = open && !loading && suggestions.length === 0

  return (
    <div
      className={`lms-search ${open ? 'is-open' : ''}`}
      role="search"
      ref={rootRef}
    >
      <Icon name="search" size={18} />
      <input
        ref={inputRef}
        type="search"
        value={term}
        placeholder={
          role === 'Faculty'
            ? 'Search classes, quizzes, students...'
            : 'Search classes, quizzes...'
        }
        aria-label="Search workspace"
        role="combobox"
        aria-expanded={open}
        aria-controls="lms-search-suggestions"
        aria-autocomplete="list"
        aria-activedescendant={
          open && suggestions[activeIndex]
            ? `lms-search-option-${activeIndex}`
            : undefined
        }
        onChange={(event) => {
          setTerm(event.target.value)
          setActiveIndex(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      <span className="lms-search-key">⌘ K</span>

      {open && (
        <div
          className="lms-search-panel"
          id="lms-search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
        >
          {loading && (
            <div className="lms-search-status">
              <span className="lms-search-spinner" />
              Searching your workspace...
            </div>
          )}

          {showEmpty && (
            <div className="lms-search-empty">
              <span className="lms-search-empty-icon">
                <Icon name="search" size={20} />
              </span>
              <strong>No matches found</strong>
              <span>Try a class name, quiz title, or page.</span>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="lms-search-list">
              {suggestions.map((item, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  id={`lms-search-option-${index}`}
                  key={`${item.kind}-${item.id || item.path || item.label}`}
                  className={`lms-search-option ${
                    index === activeIndex ? 'is-active' : ''
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectSuggestion(item)}
                >
                  <span
                    className={`lms-search-option-icon lms-tone-${
                      item.tone || 'blue'
                    }`}
                  >
                    <Icon name={item.icon || 'search'} size={16} />
                  </span>
                  <span className="lms-search-option-copy">
                    <strong>{item.title || item.label}</strong>
                    <span>{item.subtitle}</span>
                  </span>
                  <span className="lms-search-option-kind">
                    {typeLabels[item.kind === 'link' ? 'link' : item.type] ||
                      'Result'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!term.trim() && (
            <div className="lms-search-hint">
              <span>Tip</span>
              Press <kbd>⌘</kbd> <kbd>K</kbd> anytime to jump to a class, quiz,
              or page.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WorkspaceSearch
