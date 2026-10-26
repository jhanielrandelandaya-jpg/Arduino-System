import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { EmptyState, Field, Modal, PageHeader } from '../components/DashboardUI.jsx'
import { useToast } from '../context/toast.js'
import {
  PRESENTATION_THEMES,
  createBlankPresentation,
} from './presentationData.js'
import {
  addPresentation,
  copyPresentation,
  loadPresentations,
  removePresentation,
} from './presentationStore.js'
import { SlideCanvas } from './SlideCanvas.jsx'
import './Presentation.css'

const formatDate = (value) => {
  if (!value) return 'Not saved yet'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function PresentationLibrary({
  role = 'faculty',
  subjects = [],
}) {
  const navigate = useNavigate()
  const notify = useToast()
  const isFaculty = role === 'faculty'
  const [decks, setDecks] = useState(loadPresentations)
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('All')
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState({
    title: '',
    subjectId: subjects[0]?.id || '',
    theme: 'violet',
  })

  const subjectCodes = useMemo(
    () =>
      Array.from(new Set(decks.map((deck) => deck.subjectCode).filter(Boolean))).sort(),
    [decks],
  )

  const filteredDecks = decks.filter((deck) => {
    const matchesSearch = `${deck.title} ${deck.subjectCode}`
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesSubject =
      subjectFilter === 'All' || deck.subjectCode === subjectFilter
    return matchesSearch && matchesSubject
  })

  const totalSlides = decks.reduce(
    (total, deck) => total + deck.slides.length,
    0,
  )
  const latestUpdate = decks
    .map((deck) => deck.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1)

  const openCreate = () => {
    setDraft({
      title: '',
      subjectId: subjects[0]?.id || '',
      theme: 'violet',
    })
    setCreateOpen(true)
  }

  const handleCreate = (event) => {
    event.preventDefault()
    const subject = subjects.find((item) => item.id === draft.subjectId)
    const presentation = createBlankPresentation({
      title: draft.title,
      subjectCode: subject?.code || draft.subjectCode || 'General',
      theme: draft.theme,
    })
    addPresentation(presentation)
    setCreateOpen(false)
    navigate(`/faculty/presentations/${presentation.id}/edit`)
  }

  const handleDuplicate = (deck) => {
    copyPresentation(deck)
    setDecks(loadPresentations())
    notify('Presentation duplicated.')
  }

  const handleDelete = (deck) => {
    if (!window.confirm(`Delete "${deck.title}"? This cannot be undone.`)) return
    removePresentation(deck.id)
    setDecks(loadPresentations())
    notify('Presentation deleted.', 'error')
  }

  const viewerPath = (deck) =>
    isFaculty
      ? `/faculty/presentations/${deck.id}/present`
      : `/student/presentations/${deck.id}`

  const editorPath = (deck) => `/faculty/presentations/${deck.id}/edit`

  return (
    <>
      <PageHeader
        eyebrow={isFaculty ? 'Presentation Studio' : 'Presentations'}
        title={isFaculty ? 'Slides that feel designed' : 'Lesson presentations'}
        description={
          isFaculty
            ? 'Build lesson decks with editable text, shapes, images, and reusable layouts. Everything is stored as structured slide data.'
            : 'Open the presentation attached to each lesson, move through the deck, and present it full screen.'
        }
        actions={
          isFaculty ? (
            <button
              type="button"
              className="lms-btn lms-btn-primary"
              onClick={openCreate}
            >
              <Icon name="plus" size={16} />
              New presentation
            </button>
          ) : null
        }
      />

      <div className="lms-pe-library-stats">
        <div>
          <span>Decks</span>
          <strong>{decks.length}</strong>
        </div>
        <div>
          <span>Slides</span>
          <strong>{totalSlides}</strong>
        </div>
        <div>
          <span>Last edited</span>
          <strong>{formatDate(latestUpdate)}</strong>
        </div>
        <div className="lms-pe-library-tip">
          <Icon name="sparkles" size={18} />
          <span>
            {isFaculty
              ? 'Tip: start from a layout, then adjust colors and type.'
              : 'Tip: use the arrow keys while presenting to move through slides.'}
          </span>
        </div>
      </div>

      <div className="lms-toolbar">
        <label className="lms-filter-input">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search presentation or subject"
          />
        </label>
        <select
          className="lms-select"
          value={subjectFilter}
          onChange={(event) => setSubjectFilter(event.target.value)}
          aria-label="Filter presentations by subject"
        >
          <option value="All">All subjects</option>
          {subjectCodes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <span className="lms-chip">
          <Icon name="presentation" size={13} />
          {filteredDecks.length} deck{filteredDecks.length === 1 ? '' : 's'}
        </span>
      </div>

      {decks.length === 0 ? (
        <div className="lms-card">
          <EmptyState
            icon="presentation"
            title="No presentations yet"
            description={
              isFaculty
                ? 'Create your first slide deck and it will appear here.'
                : 'Your faculty has not added a presentation yet.'
            }
            action={
              isFaculty ? (
                <button
                  type="button"
                  className="lms-btn lms-btn-primary"
                  onClick={openCreate}
                >
                  Create presentation
                </button>
              ) : null
            }
          />
        </div>
      ) : filteredDecks.length === 0 ? (
        <div className="lms-card">
          <EmptyState
            icon="search"
            title="No matching presentations"
            description="Try a different search term or subject filter."
          />
        </div>
      ) : (
        <div className="lms-pe-deck-grid">
          {filteredDecks.map((deck) => (
            <article className="lms-pe-deck-card" key={deck.id}>
              <Link
                className="lms-pe-deck-preview"
                to={viewerPath(deck)}
                aria-label={`View ${deck.title}`}
              >
                <SlideCanvas
                  slide={deck.slides[0]}
                  label={`${deck.title} cover slide`}
                />
                <span className="lms-pe-deck-count">
                  {deck.slides.length} slide
                  {deck.slides.length === 1 ? '' : 's'}
                </span>
                <span className="lms-pe-deck-play">
                  <Icon name="play" size={17} />
                </span>
              </Link>

              <div className="lms-pe-deck-copy">
                <div className="lms-pe-deck-meta">
                  <span>{deck.subjectCode || 'General'}</span>
                  <span>Updated {formatDate(deck.updatedAt)}</span>
                </div>
                <h3>
                  <Link to={viewerPath(deck)}>{deck.title}</Link>
                </h3>
                <p>{deck.description || 'A LearnSpace presentation deck.'}</p>
                {deck.sourceFile && (
                  <span className="lms-pe-source-file">
                    <Icon name="fileText" size={12} />
                    {deck.sourceFile}
                  </span>
                )}
              </div>

              <div className="lms-pe-deck-actions">
                {isFaculty && (
                  <Link
                    className="lms-pe-button is-primary"
                    to={editorPath(deck)}
                  >
                    <Icon name="edit" size={14} />
                    Edit
                  </Link>
                )}
                <Link className="lms-pe-button" to={viewerPath(deck)}>
                  <Icon name="playCircle" size={14} />
                  {isFaculty ? 'Present' : 'View'}
                </Link>
                {isFaculty && (
                  <>
                    <button
                      type="button"
                      className="lms-pe-icon-button"
                      onClick={() => handleDuplicate(deck)}
                      title="Duplicate presentation"
                      aria-label={`Duplicate ${deck.title}`}
                    >
                      <Icon name="copy" size={15} />
                    </button>
                    <button
                      type="button"
                      className="lms-pe-icon-button is-danger"
                      onClick={() => handleDelete(deck)}
                      title="Delete presentation"
                      aria-label={`Delete ${deck.title}`}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <Modal
          title="New presentation"
          description="Choose a starting theme. You can change every slide later."
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="lms-btn lms-btn-secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="presentation-create-form"
                className="lms-btn lms-btn-primary"
              >
                Create and edit
              </button>
            </>
          }
        >
          <form
            id="presentation-create-form"
            className="lms-form-grid"
            onSubmit={handleCreate}
          >
            <Field label="Presentation title" className="lms-field-full">
              <input
                type="text"
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="e.g. Introduction to algorithms"
                required
                autoFocus
              />
            </Field>
            <Field label="Subject">
              <select
                value={draft.subjectId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    subjectId: event.target.value,
                  }))
                }
              >
                {subjects.length === 0 && <option value="">General</option>}
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} · {subject.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Theme">
              <select
                value={draft.theme}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    theme: event.target.value,
                  }))
                }
              >
                {Object.entries(PRESENTATION_THEMES).map(([key, theme]) => (
                  <option key={key} value={key}>
                    {theme.label}
                  </option>
                ))}
              </select>
            </Field>
          </form>
        </Modal>
      )}
    </>
  )
}
