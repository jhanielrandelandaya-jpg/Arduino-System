import { useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import { Field, Modal } from './DashboardUI.jsx'
import { useToast } from '../context/toast.js'
import { apiRequest } from '../utils/api.js'

const COMMON_FAQS = [
  {
    id: 'account-settings',
    category: 'Account',
    question: 'How do I update my profile or password?',
    answer:
      'Open Settings from the sidebar. The Profile tab lets you change your name and username, the Security tab updates your password, and the Notifications tab controls the bell menu.',
  },
  {
    id: 'sync-delay',
    category: 'Workspace',
    question: 'Why did a change take a moment to appear?',
    answer:
      'Shared classes and quizzes sync across the workspace every few seconds. If another tab or teacher made a change, wait a moment or refresh the page.',
  },
  {
    id: 'contact-support',
    category: 'Support',
    question: 'How do I contact support?',
    answer:
      'Use the contact form at the bottom of this Help Center. Include the page you were on and what you expected to happen so we can investigate faster.',
  },
]

const ROLE_FAQS = {
  Faculty: [
    {
      id: 'create-class',
      category: 'Classes',
      question: 'How do I create a class for students?',
      answer:
        'Go to My Classes and select Create new class. Add the class name, subject, subject code, term, and academic year. Published classes appear on the student dashboard automatically.',
    },
    {
      id: 'share-quiz',
      category: 'Quizzes',
      question: 'How do I share a quiz with a class?',
      answer:
        'Open All Tests and create a quiz, then choose the class it belongs to and set the status to Published. Students can take published quizzes from that class page.',
    },
    {
      id: 'monitor-students',
      category: 'Performance',
      question: 'Where can I review student scores?',
      answer:
        'Tests Monitoring shows student averages, attempts, and support flags. Reports adds sorting and CSV export for class results.',
    },
    {
      id: 'presentation-studio',
      category: 'Presentations',
      question: 'How do I build or present a slide deck?',
      answer:
        'Open Presentation Studio to create a deck, edit slides, and start a presentation. Faculty decks can be opened in presentation mode from the studio.',
    },
    {
      id: 'draft-reminder',
      category: 'Quizzes',
      question: 'Why do I see a draft quiz reminder?',
      answer:
        'Draft quizzes are not available to students. The reminder appears in the bell menu until you publish the quiz or turn off reminders in Settings.',
    },
  ],
  Student: [
    {
      id: 'find-classes',
      category: 'Classes',
      question: 'How do I find my classes?',
      answer:
        'Open My Classes to see every class shared by your teachers, including the subject code, term, and teacher. Use the search and term filters to narrow the list.',
    },
    {
      id: 'take-quiz',
      category: 'Quizzes',
      question: 'How do quizzes and attempts work?',
      answer:
        'Open My Classes, expand a class, and take its published quizzes there. Only quizzes shared by your teacher are available to answer.',
    },
    {
      id: 'notes',
      category: 'Notes',
      question: 'Where are my notes saved?',
      answer:
        'My Notes stores notes in this browser for each lesson. Select a lesson, write your notes, and use the save button before leaving the page.',
    },
    {
      id: 'presentations',
      category: 'Presentations',
      question: 'How do I view a shared presentation?',
      answer:
        'Open Lessons, select a class lesson, then open or download the attached PowerPoint file.',
    },
  ],
}

function HelpCenterModal({ user, onClose }) {
  const notify = useToast()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [ticketId, setTicketId] = useState('')

  const faqs = useMemo(() => {
    const items = [
      ...(ROLE_FAQS[user.role] || ROLE_FAQS.Student),
      ...COMMON_FAQS,
    ]
    const term = query.trim().toLowerCase()

    if (!term) {
      return items
    }

    return items.filter((item) =>
      `${item.category} ${item.question} ${item.answer}`
        .toLowerCase()
        .includes(term),
    )
  }, [query, user.role])

  const sendRequest = async (event) => {
    event.preventDefault()
    setSending(true)

    try {
      const data = await apiRequest('/support', {
        method: 'POST',
        body: JSON.stringify({
          subject,
          message,
          page: window.location.pathname,
        }),
      })
      setTicketId(data.ticket?.id || '')
      setSubject('')
      setMessage('')
      notify('Support request sent. We will follow up soon.')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      title="Help Center"
      description="Find quick answers or send a message to the LearnSpace team."
      onClose={onClose}
      size="lg"
    >
      <div className="lms-help">
        <label className="lms-help-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search help articles"
            aria-label="Search help articles"
          />
        </label>

        <div className="lms-help-list">
          {faqs.length === 0 ? (
            <div className="lms-help-empty">
              <span className="lms-help-empty-icon">
                <Icon name="search" size={20} />
              </span>
              <strong>No articles match that search</strong>
              <span>Try a shorter phrase, or send us a message below.</span>
            </div>
          ) : (
            faqs.map((item) => {
              const isOpen = openId === item.id

              return (
                <div
                  className={`lms-faq ${isOpen ? 'is-open' : ''}`}
                  key={item.id}
                >
                  <button
                    type="button"
                    className="lms-faq-question"
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                  >
                    <span>
                      <span className="lms-faq-category">{item.category}</span>
                      <strong>{item.question}</strong>
                    </span>
                    <Icon name="chevronDown" size={16} />
                  </button>
                  {isOpen && <p className="lms-faq-answer">{item.answer}</p>}
                </div>
              )
            })
          )}
        </div>

        <div className="lms-help-contact">
          <div className="lms-help-contact-head">
            <span className="lms-help-contact-icon">
              <Icon name="message" size={18} />
            </span>
            <div>
              <strong>Still need help?</strong>
              <p>
                Send us the details and we will get back to you within one
                business day.
              </p>
            </div>
          </div>

          {ticketId ? (
            <div className="lms-help-sent">
              <span className="lms-help-sent-icon">
                <Icon name="checkCircle" size={22} />
              </span>
              <div>
                <strong>Message received</strong>
                <p>
                  Your reference is{' '}
                  <code>{ticketId.slice(0, 8).toUpperCase()}</code>. We will
                  reply to your account email or username.
                </p>
              </div>
              <button
                type="button"
                className="lms-btn lms-btn-secondary lms-btn-sm"
                onClick={() => setTicketId('')}
              >
                Send another
              </button>
            </div>
          ) : (
            <form className="lms-help-form" onSubmit={sendRequest}>
              <Field label="Subject">
                <input
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="What do you need help with?"
                  minLength={3}
                  required
                />
              </Field>
              <Field
                label="Message"
                hint="Include the page you were on and what you expected to happen."
              >
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Describe the issue or question..."
                  minLength={10}
                  required
                />
              </Field>
              <div className="lms-help-form-foot">
                <span>
                  Signed in as <strong>{user.username}</strong>
                </span>
                <button
                  type="submit"
                  className="lms-btn lms-btn-primary"
                  disabled={sending}
                >
                  <Icon name="mail" size={15} />
                  {sending ? 'Sending...' : 'Send message'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default HelpCenterModal
