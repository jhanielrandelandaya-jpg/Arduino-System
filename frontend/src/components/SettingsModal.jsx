import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { Avatar, Field, Modal } from './DashboardUI.jsx'
import { useToast } from '../context/toast.js'
import { apiRequest } from '../utils/api.js'

const TABS = [
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'security', label: 'Security', icon: 'lock' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
]

const formatMemberSince = (value) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Recently'
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function SettingsModal({ user, onClose, onUserUpdate }) {
  const notify = useToast()
  const [tab, setTab] = useState('profile')
  const [fullName, setFullName] = useState(user.fullName || '')
  const [username, setUsername] = useState(user.username || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [preferences, setPreferences] = useState(null)
  const [preferencesError, setPreferencesError] = useState('')
  const [preferencesSaving, setPreferencesSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    apiRequest('/auth/settings')
      .then((data) => {
        if (!cancelled) {
          setPreferences(data.settings)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPreferencesError(error.message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const saveProfile = async (event) => {
    event.preventDefault()
    setProfileSaving(true)

    try {
      const data = await apiRequest('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, username }),
      })
      onUserUpdate?.(data.user)
      setFullName(data.user.fullName)
      setUsername(data.user.username)
      notify('Profile updated successfully.')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setProfileSaving(false)
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()

    if (newPassword !== confirmPassword) {
      notify('New passwords do not match.', 'error')
      return
    }

    setPasswordSaving(true)

    try {
      await apiRequest('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      notify('Password updated successfully.')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setPasswordSaving(false)
    }
  }

  const togglePreference = (key) => {
    setPreferences((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  const savePreferences = async (event) => {
    event.preventDefault()
    setPreferencesSaving(true)

    try {
      const data = await apiRequest('/auth/settings', {
        method: 'PUT',
        body: JSON.stringify(preferences),
      })
      setPreferences(data.settings)
      notify('Notification preferences saved.')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setPreferencesSaving(false)
    }
  }

  return (
    <Modal
      title="Settings"
      description="Manage your profile, sign-in security, and in-app notifications."
      onClose={onClose}
      size="lg"
    >
      <div className="lms-settings">
        <div className="lms-settings-tabs" role="tablist" aria-label="Settings sections">
          {TABS.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.id}
              aria-selected={tab === item.id}
              aria-controls={`lms-settings-panel-${item.id}`}
              className={`lms-settings-tab ${tab === item.id ? 'is-active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </div>

        <div
          className="lms-settings-panel"
          id={`lms-settings-panel-${tab}`}
          role="tabpanel"
        >
          {tab === 'profile' && (
            <form className="lms-settings-form" onSubmit={saveProfile}>
              <div className="lms-settings-identity">
                <Avatar name={fullName || user.fullName} size="md" />
                <div>
                  <strong>{fullName || user.fullName}</strong>
                  <span>{user.role} account</span>
                </div>
                <span className="lms-chip">
                  <Icon name="shield" size={13} />
                  {user.role}
                </span>
              </div>

              <div className="lms-form-grid">
                <Field label="Full name" className="lms-field-full">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    minLength={2}
                    required
                  />
                </Field>
                <Field
                  label="Username or email"
                  hint="You will use this to sign in to LearnSpace."
                  className="lms-field-full"
                >
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    minLength={3}
                    required
                  />
                </Field>
              </div>

              <div className="lms-settings-meta">
                <span>Member since</span>
                <strong>{formatMemberSince(user.createdAt)}</strong>
              </div>

              <div className="lms-settings-actions">
                <button
                  type="button"
                  className="lms-btn lms-btn-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="lms-btn lms-btn-primary"
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Saving...' : 'Save profile'}
                </button>
              </div>
            </form>
          )}

          {tab === 'security' && (
            <form className="lms-settings-form" onSubmit={savePassword}>
              <div className="lms-settings-note">
                <span className="lms-settings-note-icon">
                  <Icon name="lock" size={18} />
                </span>
                <div>
                  <strong>Keep your account secure</strong>
                  <p>
                    Use at least 8 characters and avoid reusing a password from
                    another site.
                  </p>
                </div>
              </div>

              <Field label="Current password">
                <div className="lms-password-field">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </Field>

              <div className="lms-form-grid">
                <Field label="New password" hint="At least 8 characters.">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Field>
                <Field label="Confirm new password">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Field>
              </div>

              <button
                type="button"
                className="lms-settings-show"
                onClick={() => setShowPasswords((current) => !current)}
              >
                <Icon name={showPasswords ? 'eyeOff' : 'eye'} size={15} />
                {showPasswords ? 'Hide passwords' : 'Show passwords'}
              </button>

              <div className="lms-settings-actions">
                <button
                  type="button"
                  className="lms-btn lms-btn-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="lms-btn lms-btn-primary"
                  disabled={passwordSaving}
                >
                  {passwordSaving ? 'Updating...' : 'Update password'}
                </button>
              </div>
            </form>
          )}

          {tab === 'notifications' && (
            <form className="lms-settings-form" onSubmit={savePreferences}>
              {preferencesError ? (
                <div className="lms-settings-error">
                  <Icon name="alert" size={17} />
                  {preferencesError}
                </div>
              ) : !preferences ? (
                <div className="lms-settings-loading">
                  <span className="lms-search-spinner" />
                  Loading preferences...
                </div>
              ) : (
                <>
                  <div className="lms-settings-note">
                    <span className="lms-settings-note-icon">
                      <Icon name="bell" size={18} />
                    </span>
                    <div>
                      <strong>In-app notifications</strong>
                      <p>
                        Choose which updates appear in the bell menu. You can
                        change these at any time.
                      </p>
                    </div>
                  </div>

                  <div className="lms-settings-switches">
                    <label className="lms-switch-row">
                      <span>
                        <strong>Class updates</strong>
                        <small>New classes and changes to class details.</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={preferences.classUpdates}
                        onChange={() => togglePreference('classUpdates')}
                      />
                      <span className="lms-switch" aria-hidden="true" />
                    </label>

                    <label className="lms-switch-row">
                      <span>
                        <strong>Quiz updates</strong>
                        <small>
                          New quizzes, due date changes, and status updates.
                        </small>
                      </span>
                      <input
                        type="checkbox"
                        checked={preferences.quizUpdates}
                        onChange={() => togglePreference('quizUpdates')}
                      />
                      <span className="lms-switch" aria-hidden="true" />
                    </label>

                    <label className="lms-switch-row">
                      <span>
                        <strong>Reminders</strong>
                        <small>
                          Draft quiz reminders and quizzes due in the next week.
                        </small>
                      </span>
                      <input
                        type="checkbox"
                        checked={preferences.reminders}
                        onChange={() => togglePreference('reminders')}
                      />
                      <span className="lms-switch" aria-hidden="true" />
                    </label>
                  </div>

                  <div className="lms-settings-actions">
                    <button
                      type="button"
                      className="lms-btn lms-btn-secondary"
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="lms-btn lms-btn-primary"
                      disabled={preferencesSaving}
                    >
                      {preferencesSaving ? 'Saving...' : 'Save preferences'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default SettingsModal
