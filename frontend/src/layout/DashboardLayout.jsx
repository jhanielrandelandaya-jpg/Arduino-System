import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { Avatar } from '../components/DashboardUI.jsx'
import { useToast } from '../context/toast.js'
import './DashboardLayout.css'

const navigation = {
  Student: [
    {
      label: 'Workspace',
      items: [
        { label: 'Overview', to: '/student/dashboard', icon: 'grid' },
        { label: 'My Classes', to: '/student/subjects', icon: 'book' },
        { label: 'Lessons', to: '/student/lessons', icon: 'presentation' },
        { label: 'Presentations', to: '/student/presentations', icon: 'layers' },
        { label: 'My Notes', to: '/student/notes', icon: 'notes' },
      ],
    },
    {
      label: 'Assessment',
      items: [
        { label: 'My Quizzes', to: '/student/quizzes', icon: 'quiz' },
        { label: 'Quiz Results', to: '/student/results', icon: 'chart' },
        { label: 'Learning Progress', to: '/student/progress', icon: 'trend' },
      ],
    },
  ],
  Faculty: [
    {
      label: 'Menu',
      items: [
        { label: 'Dashboard', to: '/faculty/dashboard', icon: 'grid' },
        { label: 'My Classes', to: '/faculty/subjects', icon: 'book' },
        { label: 'Lessons', to: '/faculty/lessons', icon: 'presentation' },
        {
          label: 'Presentation Studio',
          to: '/faculty/presentations',
          icon: 'layers',
        },
        { label: 'All Tests', to: '/faculty/quizzes', icon: 'quiz' },
        {
          label: 'Tests Monitoring',
          to: '/faculty/performance',
          icon: 'users',
        },
        { label: 'Reports', to: '/faculty/reports', icon: 'report' },
      ],
    },
    {
      label: 'Account',
      items: [
        {
          label: 'Settings',
          icon: 'settings',
          notice: 'Settings will be available soon.',
        },
        {
          label: 'Help Center',
          icon: 'help',
          notice: 'Help Center is coming soon.',
        },
      ],
    },
  ],
}

const roleDetails = {
  Student: {
    label: 'Student workspace',
    badge: 'STUDENT',
  },
  Faculty: {
    label: 'Faculty workspace',
    badge: 'FACULTY',
  },
}

function DashboardLayout({ role, user, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const notify = useToast()
  const meta = roleDetails[role]
  const groups = navigation[role]

  const handleLogout = () => {
    onLogout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`lms-shell lms-role-${role.toLowerCase()}`}>
      <aside className={`lms-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="lms-sidebar-top">
          <NavLink
            to={`/${role.toLowerCase()}/dashboard`}
            className="lms-brand"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="lms-brand-mark">L</span>
            <span className="lms-brand-copy">
              <strong>LearnSpace</strong>
              <small>{meta.label}</small>
            </span>
          </NavLink>

          <div className="lms-role-card">
            <span className="lms-role-icon">
              <Icon
                name={role === 'Faculty' ? 'graduation' : 'book'}
                size={18}
              />
            </span>
            <div>
              <span>Signed in as</span>
              <strong>{meta.badge}</strong>
            </div>
          </div>
        </div>

        <nav className="lms-nav" aria-label={`${role} navigation`}>
          {groups.map((group) => (
            <div className="lms-nav-group" key={group.label}>
              <span className="lms-nav-label">{group.label}</span>
              {group.items.map((item) =>
                item.to ? (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `lms-nav-link ${isActive ? 'is-active' : ''}`
                    }
                  >
                    <Icon name={item.icon} size={19} />
                    <span>{item.label}</span>
                  </NavLink>
                ) : (
                  <button
                    type="button"
                    key={item.label}
                    className="lms-nav-link"
                    onClick={() => {
                      setSidebarOpen(false)
                      notify(item.notice)
                    }}
                  >
                    <Icon name={item.icon} size={19} />
                    <span>{item.label}</span>
                  </button>
                ),
              )}
            </div>
          ))}
        </nav>

        <div className="lms-sidebar-bottom">
          {role === 'Student' ? (
            <>
              <div className="lms-promo-card">
                <span className="lms-promo-icon">
                  <Icon name="sparkles" size={16} />
                </span>
                <strong>Unlock Premium Access</strong>
                <p>Unlimited practice quizzes, offline notes, and priority support.</p>
                <button
                  type="button"
                  className="lms-promo-btn"
                  onClick={() => notify('Premium plans are coming soon.')}
                >
                  Upgrade Pro
                  <Icon name="arrowRight" size={13} />
                </button>
              </div>

              <div className="lms-sidebar-utility">
                <button
                  type="button"
                  onClick={() => notify('Settings will be available soon.')}
                >
                  <Icon name="settings" size={16} />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => notify('Help Center is coming soon.')}
                >
                  <Icon name="help" size={16} />
                  Help Center
                </button>
              </div>
            </>
          ) : (
            <div className="lms-promo-card lms-promo-faculty">
              <span className="lms-promo-icon">
                <Icon name="sparkles" size={16} />
              </span>
              <strong>Upgrade to Pro</strong>
              <p>
                Advanced class analytics, bulk grading, and priority faculty
                support.
              </p>
              <button
                type="button"
                className="lms-promo-btn"
                onClick={() => notify('Faculty Pro plans are coming soon.')}
              >
                Upgrade Pro
                <Icon name="arrowRight" size={13} />
              </button>
            </div>
          )}

          <div className="lms-sidebar-user">
            <Avatar name={user.fullName} size="sm" />
            <div className="lms-sidebar-user-copy">
              <strong>{user.fullName}</strong>
              <span>{role}</span>
            </div>
            <button
              type="button"
              className="lms-sidebar-logout"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="lms-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <div className="lms-main">
        <header className="lms-topbar">
          <button
            type="button"
            className="lms-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
          >
            <Icon name="menu" size={21} />
          </button>

          {role === 'Faculty' && (
            <span className="lms-topbar-heading">Dashboard</span>
          )}

          <div className="lms-search" role="search">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder={
                role === 'Faculty'
                  ? 'Search subjects, lessons, students...'
                  : 'Search courses, lessons...'
              }
              aria-label="Search workspace"
            />
            <span className="lms-search-key">⌘ K</span>
          </div>

          <div className="lms-topbar-actions">
            {role === 'Faculty' && (
              <div className="lms-faculty-utility">
                <button
                  type="button"
                  className="lms-icon-btn"
                  aria-label="Help"
                  title="Help"
                  onClick={() => notify('Help Center is coming soon.')}
                >
                  <Icon name="help" size={18} />
                </button>
                <button
                  type="button"
                  className="lms-icon-btn"
                  aria-label="Documentation"
                  title="Documentation"
                  onClick={() => notify('Documentation is coming soon.')}
                >
                  <Icon name="fileText" size={18} />
                </button>
                <button
                  type="button"
                  className="lms-icon-btn"
                  aria-label="Messages"
                  title="Messages"
                  onClick={() => notify('Messages are coming soon.')}
                >
                  <Icon name="message" size={18} />
                </button>
              </div>
            )}

            <button
              type="button"
              className="lms-icon-btn lms-notification"
              aria-label="Notifications"
            >
              <Icon name="bell" size={19} />
              <span className="lms-notification-dot" />
            </button>

            {role === 'Faculty' && (
              <button
                type="button"
                className="lms-btn lms-btn-primary lms-btn-sm lms-request-btn"
                onClick={() => notify('Feature requests are coming soon.')}
              >
                <Icon name="sparkles" size={14} />
                Request Feature
              </button>
            )}

            <span className="lms-topbar-divider" />

            <div className="lms-topbar-user">
              <Avatar name={user.fullName} size="sm" />
              <div>
                <strong>{user.fullName}</strong>
                <span>{role}</span>
              </div>
            </div>

            <button
              type="button"
              className="lms-icon-btn lms-topbar-logout"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>

        <main className="lms-content">{children}</main>

        <footer className="lms-footer">
          <span>LearnSpace · Shared learning platform</span>
          <span>Protected {role.toLowerCase()} access</span>
        </footer>
      </div>
    </div>
  )
}

export default DashboardLayout
