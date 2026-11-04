import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { Avatar } from '../components/DashboardUI.jsx'
import HelpCenterModal from '../components/HelpCenterModal.jsx'
import NotificationMenu from '../components/NotificationMenu.jsx'
import SettingsModal from '../components/SettingsModal.jsx'
import WorkspaceSearch from '../components/WorkspaceSearch.jsx'
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
        { label: 'My Notes', to: '/student/notes', icon: 'notes' },
      ],
    },
    {
      label: 'Assessment',
      items: [
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
          nested: true,
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
          action: 'settings',
        },
        {
          label: 'Help Center',
          icon: 'help',
          action: 'help',
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

const facultyPageTitles = [
  { path: '/faculty/dashboard', label: 'Dashboard' },
  { path: '/faculty/subjects', label: 'My Classes' },
  { path: '/faculty/lessons', label: 'Lessons' },
  { path: '/faculty/presentations', label: 'Presentation Studio' },
  { path: '/faculty/quizzes', label: 'All Tests' },
  { path: '/faculty/performance', label: 'Tests Monitoring' },
  { path: '/faculty/reports', label: 'Reports' },
]

const getPageTitle = (role, pathname) => {
  if (role !== 'Faculty') {
    return ''
  }

  const match = facultyPageTitles.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  )

  return match?.label || 'Faculty workspace'
}

function DashboardLayout({ role, user, onLogout, onUserUpdate, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const notify = useToast()
  const meta = roleDetails[role]
  const groups = navigation[role]
  const pageTitle = getPageTitle(role, location.pathname)

  useEffect(() => {
    if (role !== 'Faculty') {
      return undefined
    }

    document.title = `${pageTitle} · LearnSpace`

    return () => {
      document.title = 'LearnSpace'
    }
  }, [pageTitle, role])

  const handleLogout = () => {
    onLogout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`lms-shell lms-role-${role.toLowerCase()}`}>
      <a className="lms-skip-link" href="#lms-main-content">
        Skip to content
      </a>

      <aside className={`lms-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="lms-sidebar-top">
          <button
            type="button"
            className="lms-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" size={18} />
          </button>

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
                    end={!item.nested}
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

                      if (item.action === 'settings') {
                        setSettingsOpen(true)
                        return
                      }

                      if (item.action === 'help') {
                        setHelpOpen(true)
                        return
                      }

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
          {role === 'Student' && (
            <div className="lms-sidebar-utility">
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false)
                  setSettingsOpen(true)
                }}
              >
                <Icon name="settings" size={16} />
                Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false)
                  setHelpOpen(true)
                }}
              >
                <Icon name="help" size={16} />
                Help Center
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
            <span className="lms-topbar-heading">{pageTitle}</span>
          )}

          <WorkspaceSearch
            role={role}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
          />

          <div className="lms-topbar-actions">
            <NotificationMenu role={role} />

            {role === 'Faculty' && (
              <button
                type="button"
                className="lms-btn lms-btn-secondary lms-btn-sm lms-request-btn"
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

        <main className="lms-content" id="lms-main-content" tabIndex={-1}>
          {children}
        </main>

        <footer className="lms-footer">
          <span>LearnSpace · Shared learning platform</span>
          <span>Protected {role.toLowerCase()} access</span>
        </footer>
      </div>

      {settingsOpen && (
        <SettingsModal
          user={user}
          onClose={() => setSettingsOpen(false)}
          onUserUpdate={onUserUpdate}
        />
      )}

      {helpOpen && (
        <HelpCenterModal user={user} onClose={() => setHelpOpen(false)} />
      )}
    </div>
  )
}

export default DashboardLayout
