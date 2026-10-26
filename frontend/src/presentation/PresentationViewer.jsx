import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { loadPresentation } from './presentationStore.js'
import { SlideCanvas } from './SlideCanvas.jsx'
import './Presentation.css'

export default function PresentationViewer({ role = 'Student' }) {
  const { presentationId } = useParams()
  const [deck] = useState(() => loadPresentation(presentationId))
  const [index, setIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const shellRef = useRef(null)
  const isFaculty = role === 'Faculty'
  const backPath = isFaculty
    ? '/faculty/presentations'
    : '/student/presentations'

  useEffect(() => {
    const handleFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreen)
    return () => document.removeEventListener('fullscreenchange', handleFullscreen)
  }, [])

  useEffect(() => {
    if (!deck) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown') {
        event.preventDefault()
        setIndex((current) => Math.min(current + 1, deck.slides.length - 1))
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        setIndex((current) => Math.max(current - 1, 0))
      }
      if (event.key === 'Home') {
        event.preventDefault()
        setIndex(0)
      }
      if (event.key === 'End') {
        event.preventDefault()
        setIndex(deck.slides.length - 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deck])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await shellRef.current?.requestFullscreen()
      }
    } catch {
      setIsFullscreen(false)
    }
  }

  if (!deck) {
    return (
      <div className="lms-card lms-pe-missing">
        <Icon name="presentation" size={34} />
        <h2>Presentation not found</h2>
        <p>This deck may have been removed or the link is out of date.</p>
        <Link className="lms-btn lms-btn-primary" to={backPath}>
          Back to presentations
        </Link>
      </div>
    )
  }

  const slide = deck.slides[index]
  const progress = ((index + 1) / deck.slides.length) * 100

  return (
    <div className="lms-pe-viewer" ref={shellRef}>
      <header className="lms-pe-viewer-head">
        <Link className="lms-pe-viewer-back" to={backPath}>
          <Icon name="chevronLeft" size={17} />
          <span>Back to presentations</span>
        </Link>
        <div className="lms-pe-viewer-title">
          <span>{deck.subjectCode || 'Presentation'}</span>
          <strong>{deck.title}</strong>
        </div>
        <div className="lms-pe-viewer-actions">
          {isFaculty && (
            <Link
              className="lms-pe-viewer-action"
              to={`/faculty/presentations/${deck.id}/edit`}
            >
              <Icon name="edit" size={15} />
              Edit
            </Link>
          )}
          <button
            type="button"
            className="lms-pe-viewer-action"
            onClick={toggleFullscreen}
          >
            <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={15} />
            {isFullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
      </header>

      <main className="lms-pe-viewer-stage">
        <button
          type="button"
          className="lms-pe-viewer-arrow is-prev"
          onClick={() => setIndex((current) => Math.max(current - 1, 0))}
          disabled={index === 0}
          aria-label="Previous slide"
        >
          <Icon name="chevronLeft" size={23} />
        </button>

        <div className="lms-pe-viewer-canvas">
          <SlideCanvas
            key={slide.id}
            slide={slide}
            label={`${deck.title}, slide ${index + 1}`}
          />
        </div>

        <button
          type="button"
          className="lms-pe-viewer-arrow is-next"
          onClick={() =>
            setIndex((current) => Math.min(current + 1, deck.slides.length - 1))
          }
          disabled={index === deck.slides.length - 1}
          aria-label="Next slide"
        >
          <Icon name="chevronRight" size={23} />
        </button>
      </main>

      <div className="lms-pe-viewer-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <footer className="lms-pe-viewer-foot">
        <div className="lms-pe-viewer-counter" aria-live="polite">
          <strong>{String(index + 1).padStart(2, '0')}</strong>
          <span>/ {String(deck.slides.length).padStart(2, '0')}</span>
        </div>
        <p>
          Use <kbd>←</kbd> <kbd>→</kbd> or the space bar to move through the deck.
        </p>
        <button
          type="button"
          className="lms-pe-viewer-action"
          onClick={() =>
            setIndex((current) => Math.min(current + 1, deck.slides.length - 1))
          }
          disabled={index === deck.slides.length - 1}
        >
          Next slide
          <Icon name="arrowRight" size={15} />
        </button>
      </footer>

      <div className="lms-pe-viewer-tray">
        <div className="lms-pe-viewer-tray-scroll">
          {deck.slides.map((item, slideIndex) => (
            <button
              key={item.id}
              type="button"
              className={`lms-pe-viewer-thumb ${
                slideIndex === index ? 'is-active' : ''
              }`}
              onClick={() => setIndex(slideIndex)}
              aria-label={`Go to slide ${slideIndex + 1}`}
            >
              <SlideCanvas slide={item} label={`Slide ${slideIndex + 1}`} />
              <span>{slideIndex + 1}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
