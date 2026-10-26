import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { useToast } from '../context/toast.js'
import {
  PRESENTATION_FONTS,
  SLIDE_BACKGROUNDS,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  TEMPLATE_CATALOG,
  buildTemplateSlide,
  backgroundCss,
  createEmptySlide,
  createId,
  createImageElement,
  createShapeElement,
  createTextElement,
  duplicateSlide,
  getPresentationTheme,
} from './presentationData.js'
import { loadPresentation, savePresentation } from './presentationStore.js'
import {
  exportPresentationJson,
  exportSlidePng,
  printPresentation,
} from './presentationExport.js'
import { SlideCanvas, SlideElementBody } from './SlideCanvas.jsx'
import { slideElementStyle, useSlideScale } from './slideCanvasUtils.js'
import './Presentation.css'

const HISTORY_LIMIT = 60

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value))

function useDeckHistory(initial) {
  const [history, setHistory] = useState({
    past: [],
    present: initial,
    future: [],
  })

  const commit = useCallback((updater) => {
    setHistory((current) => {
      const next =
        typeof updater === 'function' ? updater(current.present) : updater
      if (!next || next === current.present) return current
      return {
        past: [...current.past.slice(-(HISTORY_LIMIT - 1)), current.present],
        present: next,
        future: [],
      }
    })
  }, [])

  const replace = useCallback((updater) => {
    setHistory((current) => {
      const next =
        typeof updater === 'function' ? updater(current.present) : updater
      if (!next || next === current.present) return current
      return { ...current, present: next }
    })
  }, [])

  const snapshot = useCallback(() => {
    setHistory((current) => ({
      past: [...current.past.slice(-(HISTORY_LIMIT - 1)), current.present],
      present: current.present,
      future: [],
    }))
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => {
      if (!current.past.length) return current
      return {
        past: current.past.slice(0, -1),
        present: current.past[current.past.length - 1],
        future: [current.present, ...current.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((current) => {
      if (!current.future.length) return current
      return {
        past: [...current.past, current.present],
        present: current.future[0],
        future: current.future.slice(1),
      }
    })
  }, [])

  return {
    deck: history.present,
    commit,
    replace,
    snapshot,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}

export default function PresentationEditor() {
  const { presentationId } = useParams()
  return (
    <EditorLoader
      key={presentationId}
      presentationId={presentationId}
    />
  )
}

function EditorLoader({ presentationId }) {
  const [initial] = useState(() => loadPresentation(presentationId))

  if (!initial) {
    return (
      <div className="lms-card lms-pe-missing">
        <Icon name="presentation" size={34} />
        <h2>Presentation not found</h2>
        <p>This deck may have been deleted, or the link is out of date.</p>
        <Link className="lms-btn lms-btn-primary" to="/faculty/presentations">
          Back to Presentation Studio
        </Link>
      </div>
    )
  }

  return <Editor initial={initial} />
}

function Editor({ initial }) {
  const notify = useToast()
  const {
    deck,
    commit: recordCommit,
    replace: recordReplace,
    snapshot,
    undo: recordUndo,
    redo: recordRedo,
    canUndo,
    canRedo,
  } = useDeckHistory(initial)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [toolTab, setToolTab] = useState('templates')
  const [saveState, setSaveState] = useState('saved')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [canvasFitRef, stageScale] = useSlideScale()
  const stageRef = useRef(null)
  const interactionRef = useRef(null)
  const fileInputRef = useRef(null)
  const latestDeckRef = useRef(deck)

  const commit = useCallback(
    (updater) => {
      setSaveState('saving')
      recordCommit(updater)
    },
    [recordCommit],
  )

  const replace = useCallback(
    (updater) => {
      setSaveState('saving')
      recordReplace(updater)
    },
    [recordReplace],
  )

  const undo = useCallback(() => {
    setSaveState('saving')
    recordUndo()
  }, [recordUndo])

  const redo = useCallback(() => {
    setSaveState('saving')
    recordRedo()
  }, [recordRedo])

  const slides = deck.slides
  const activeIndex = Math.min(currentIndex, Math.max(slides.length - 1, 0))
  const currentSlide = slides[activeIndex]
  const selectedElement =
    currentSlide?.elements?.find((element) => element.id === selectedId) || null
  const theme = getPresentationTheme(deck.theme)

  useEffect(() => {
    latestDeckRef.current = deck
  }, [deck])

  useEffect(() => {
    const timer = setTimeout(() => {
      savePresentation(deck)
      setSaveState('saved')
    }, 700)
    return () => clearTimeout(timer)
  }, [deck])

  useEffect(
    () => () => {
      savePresentation(latestDeckRef.current)
    },
    [],
  )

  const saveNow = useCallback(() => {
    savePresentation(deck)
    setSaveState('saved')
    notify('Presentation saved.')
  }, [deck, notify])

  const updateSlide = useCallback(
    (slideUpdater, { replaceOnly = false } = {}) => {
      const update = (current) => ({
        ...current,
        slides: current.slides.map((slide, index) => {
          if (index !== activeIndex) return slide
          return typeof slideUpdater === 'function'
            ? slideUpdater(slide)
            : { ...slide, ...slideUpdater }
        }),
      })
      if (replaceOnly) replace(update)
      else commit(update)
    },
    [activeIndex, commit, replace],
  )

  const updateElement = useCallback(
    (elementId, patch, { replaceOnly = false } = {}) => {
      updateSlide(
        (slide) => ({
          ...slide,
          elements: slide.elements.map((element) =>
            element.id === elementId ? { ...element, ...patch } : element,
          ),
        }),
        { replaceOnly },
      )
    },
    [updateSlide],
  )

  const updateSelected = (patch, { replaceOnly = false } = {}) => {
    if (!selectedId) return
    updateElement(selectedId, patch, { replaceOnly })
  }

  const addElementToSlide = (element) => {
    commit((current) => ({
      ...current,
      slides: current.slides.map((slide, index) =>
        index === activeIndex
          ? { ...slide, elements: [...slide.elements, element] }
          : slide,
      ),
    }))
    setSelectedId(element.id)
  }

  const addTextPreset = (preset) => {
    const presets = {
      heading: { text: 'Add a heading', fontSize: 56, fontWeight: 800, h: 100 },
      subheading: { text: 'Add a subheading', fontSize: 34, fontWeight: 700, h: 72 },
      body: {
        text: 'Add body text to explain the idea in a little more detail.',
        fontSize: 23,
        fontWeight: 500,
        h: 150,
      },
    }
    const presetValues = presets[preset]
    addElementToSlide(
      createTextElement({
        ...presetValues,
        x: 180,
        y: 240,
        w: 820,
        themeKey: deck.theme,
      }),
    )
  }

  const handleUpload = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify('Choose a PNG, JPG, GIF, or WebP image.', 'error')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      notify('Images must be smaller than 4 MB.', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const maxWidth = 470
        const maxHeight = 340
        const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
        const width = Math.round(image.width * ratio)
        const height = Math.round(image.height * ratio)
        addElementToSlide(
          createImageElement(reader.result, {
            x: Math.round((SLIDE_WIDTH - width) / 2),
            y: Math.round((SLIDE_HEIGHT - height) / 2),
            w: width,
            h: height,
          }),
        )
        notify('Image added to the slide.')
      }
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  const addSlideFromTemplate = (templateId) => {
    const slide = buildTemplateSlide(templateId, deck.theme)
    const insertAt = activeIndex + 1
    commit((current) => {
      const nextSlides = [...current.slides]
      nextSlides.splice(insertAt, 0, slide)
      return { ...current, slides: nextSlides }
    })
    setCurrentIndex(insertAt)
    setSelectedId(null)
  }

  const addBlankSlide = () => {
    const slide = createEmptySlide(deck.theme)
    const insertAt = activeIndex + 1
    commit((current) => {
      const nextSlides = [...current.slides]
      nextSlides.splice(insertAt, 0, slide)
      return { ...current, slides: nextSlides }
    })
    setCurrentIndex(insertAt)
    setSelectedId(null)
  }

  const duplicateCurrentSlide = () => {
    const slide = duplicateSlide(currentSlide)
    const insertAt = activeIndex + 1
    commit((current) => {
      const nextSlides = [...current.slides]
      nextSlides.splice(insertAt, 0, slide)
      return { ...current, slides: nextSlides }
    })
    setCurrentIndex(insertAt)
    setSelectedId(null)
    notify('Slide duplicated.')
  }

  const deleteCurrentSlide = () => {
    if (slides.length === 1) {
      notify('A presentation needs at least one slide.', 'error')
      return
    }
    const nextIndex = activeIndex > 0 ? activeIndex - 1 : 0
    commit((current) => ({
      ...current,
      slides: current.slides.filter((_, index) => index !== activeIndex),
    }))
    setCurrentIndex(nextIndex)
    setSelectedId(null)
  }

  const duplicateSelected = () => {
    if (!selectedElement) return
    const copy = {
      ...selectedElement,
      id: createId('el'),
      x: selectedElement.x + 24,
      y: selectedElement.y + 24,
    }
    updateSlide((slide) => ({
      ...slide,
      elements: [...slide.elements, copy],
    }))
    setSelectedId(copy.id)
  }

  const deleteSelected = () => {
    if (!selectedId) return
    updateSlide((slide) => ({
      ...slide,
      elements: slide.elements.filter((element) => element.id !== selectedId),
    }))
    setSelectedId(null)
  }

  const moveLayer = (direction) => {
    if (!selectedElement) return
    updateSlide((slide) => {
      const index = slide.elements.findIndex(
        (element) => element.id === selectedElement.id,
      )
      const target = clampNumber(index + direction, 0, slide.elements.length - 1)
      if (index === target) return slide
      const elements = [...slide.elements]
      const [element] = elements.splice(index, 1)
      elements.splice(target, 0, element)
      return { ...slide, elements }
    })
  }

  const beginMove = (event, element) => {
    if (event.button !== 0) return
    event.stopPropagation()
    setSelectedId(element.id)
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    interactionRef.current = {
      mode: 'move',
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      start: { x: element.x, y: element.y },
      snapped: false,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const beginResize = (event, element, handle) => {
    if (event.button !== 0) return
    event.stopPropagation()
    setSelectedId(element.id)
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    interactionRef.current = {
      mode: 'resize',
      id: element.id,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      start: {
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
      },
      snapped: false,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const beginRotate = (event, element) => {
    if (event.button !== 0) return
    event.stopPropagation()
    setSelectedId(element.id)
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    const centerX =
      rect.left + (element.x + element.w / 2) * (rect.width / SLIDE_WIDTH)
    const centerY =
      rect.top + (element.y + element.h / 2) * (rect.height / SLIDE_HEIGHT)
    interactionRef.current = {
      mode: 'rotate',
      id: element.id,
      rect,
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      startRotation: element.rotation || 0,
      snapped: false,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event) => {
    const interaction = interactionRef.current
    if (!interaction) return
    if (!interaction.snapped) {
      snapshot()
      interaction.snapped = true
    }
    const factorX = SLIDE_WIDTH / interaction.rect.width
    const factorY = SLIDE_HEIGHT / interaction.rect.height

    if (interaction.mode === 'move') {
      const x =
        interaction.start.x + (event.clientX - interaction.startX) * factorX
      const y =
        interaction.start.y + (event.clientY - interaction.startY) * factorY
      updateElement(interaction.id, { x, y }, { replaceOnly: true })
      return
    }

    if (interaction.mode === 'resize') {
      const dx = (event.clientX - interaction.startX) * factorX
      const dy = (event.clientY - interaction.startY) * factorY
      const minSize = 36
      let { x, y, w, h } = interaction.start
      if (interaction.handle.includes('e')) {
        w = Math.max(minSize, interaction.start.w + dx)
      }
      if (interaction.handle.includes('s')) {
        h = Math.max(minSize, interaction.start.h + dy)
      }
      if (interaction.handle.includes('w')) {
        w = Math.max(minSize, interaction.start.w - dx)
        x = interaction.start.x + interaction.start.w - w
      }
      if (interaction.handle.includes('n')) {
        h = Math.max(minSize, interaction.start.h - dy)
        y = interaction.start.y + interaction.start.h - h
      }
      updateElement(interaction.id, { x, y, w, h }, { replaceOnly: true })
      return
    }

    if (interaction.mode === 'rotate') {
      const angle = Math.atan2(
        event.clientY - interaction.centerY,
        event.clientX - interaction.centerX,
      )
      const rotation =
        interaction.startRotation +
        ((angle - interaction.startAngle) * 180) / Math.PI
      updateElement(interaction.id, { rotation }, { replaceOnly: true })
    }
  }

  const endPointerInteraction = (event) => {
    if (!interactionRef.current) return
    const element = event.currentTarget
    if (element?.hasPointerCapture?.(event.pointerId)) {
      element.releasePointerCapture(event.pointerId)
    }
    interactionRef.current = null
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      const modifier = event.ctrlKey || event.metaKey
      if (modifier && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveNow()
        return
      }

      const target = event.target
      const isEditing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if (isEditing) return

      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }

      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault()
        deleteSelected()
        return
      }

      if (selectedId && event.key.startsWith('Arrow')) {
        event.preventDefault()
        const amount = event.shiftKey ? 10 : 2
        const deltas = {
          ArrowLeft: [-amount, 0],
          ArrowRight: [amount, 0],
          ArrowUp: [0, -amount],
          ArrowDown: [0, amount],
        }
        const [dx, dy] = deltas[event.key] || [0, 0]
        const element = currentSlide.elements.find(
          (item) => item.id === selectedId,
        )
        if (element) {
          updateElement(selectedId, {
            x: element.x + dx,
            y: element.y + dy,
          })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const runExport = async (type) => {
    setExportOpen(false)
    setExportBusy(true)
    try {
      if (type === 'png') {
        await exportSlidePng(deck, currentSlide, activeIndex)
        notify('Current slide downloaded as PNG.')
      } else if (type === 'json') {
        exportPresentationJson(deck)
        notify('Presentation JSON downloaded.')
      } else if (type === 'print') {
        await printPresentation(deck)
      }
    } catch (error) {
      notify(error.message || 'The export could not be completed.', 'error')
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <div className="lms-pe-editor">
      <header className="lms-pe-editor-top">
        <div className="lms-pe-editor-title-group">
          <Link className="lms-pe-back" to="/faculty/presentations">
            <Icon name="chevronLeft" size={16} />
            Studio
          </Link>
          <span className="lms-pe-top-divider" />
          <input
            className="lms-pe-deck-title"
            value={deck.title}
            onFocus={snapshot}
            onChange={(event) =>
              replace((current) => ({ ...current, title: event.target.value }))
            }
            aria-label="Presentation title"
          />
          <span className={`lms-pe-save-state is-${saveState}`}>
            {saveState === 'saving' ? 'Saving...' : 'Saved'}
          </span>
        </div>

        <div className="lms-pe-editor-actions">
          <button
            type="button"
            className="lms-pe-icon-button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <Icon name="undo" size={17} />
          </button>
          <button
            type="button"
            className="lms-pe-icon-button"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Icon name="redo" size={17} />
          </button>
          <span className="lms-pe-top-divider" />
          <button
            type="button"
            className="lms-pe-button"
            onClick={saveNow}
          >
            Save
          </button>
          <div className="lms-pe-export">
            <button
              type="button"
              className="lms-pe-button"
              onClick={() => setExportOpen((open) => !open)}
              disabled={exportBusy}
              aria-expanded={exportOpen}
            >
              <Icon name="download" size={15} />
              {exportBusy ? 'Exporting...' : 'Export'}
              <Icon name="chevronDown" size={13} />
            </button>
            {exportOpen && (
              <div className="lms-pe-export-menu">
                <button type="button" onClick={() => runExport('png')}>
                  <Icon name="image" size={15} />
                  Current slide as PNG
                </button>
                <button type="button" onClick={() => runExport('json')}>
                  <Icon name="fileText" size={15} />
                  Presentation JSON
                </button>
                <button type="button" onClick={() => runExport('print')}>
                  <Icon name="print" size={15} />
                  Print deck / PDF
                </button>
              </div>
            )}
          </div>
          <Link
            className="lms-pe-button is-primary"
            to={`/faculty/presentations/${deck.id}/present`}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="playCircle" size={15} />
            Present
          </Link>
        </div>
      </header>

      <div className="lms-pe-editor-body">
        <aside className="lms-pe-tools" aria-label="Presentation tools">
          <div className="lms-pe-tool-tabs">
            {[
              ['templates', 'grid', 'Templates'],
              ['text', 'text', 'Text'],
              ['shapes', 'square', 'Shapes'],
              ['uploads', 'upload', 'Uploads'],
              ['backgrounds', 'palette', 'Backgrounds'],
            ].map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                className={toolTab === id ? 'is-active' : ''}
                onClick={() => setToolTab(id)}
                aria-label={label}
              >
                <Icon name={icon} size={17} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="lms-pe-tool-panel">
            {toolTab === 'templates' && (
              <div className="lms-pe-templates">
                <div className="lms-pe-panel-head">
                  <strong>Templates</strong>
                  <span>Add a slide</span>
                </div>
                <div className="lms-pe-template-grid">
                  {TEMPLATE_CATALOG.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="lms-pe-template"
                      onClick={() => addSlideFromTemplate(template.id)}
                    >
                      <span
                        className={`lms-pe-template-thumb is-${template.id}`}
                        aria-hidden="true"
                      >
                        <i />
                        <i />
                        <i />
                      </span>
                      <strong>{template.label}</strong>
                      <small>{template.hint}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {toolTab === 'text' && (
              <div>
                <div className="lms-pe-panel-head">
                  <strong>Text</strong>
                  <span>Click to add</span>
                </div>
                <div className="lms-pe-preset-list">
                  <button
                    type="button"
                    className="lms-pe-text-preset is-heading"
                    onClick={() => addTextPreset('heading')}
                  >
                    Add a heading
                  </button>
                  <button
                    type="button"
                    className="lms-pe-text-preset is-subheading"
                    onClick={() => addTextPreset('subheading')}
                  >
                    Add a subheading
                  </button>
                  <button
                    type="button"
                    className="lms-pe-text-preset is-body"
                    onClick={() => addTextPreset('body')}
                  >
                    Add body text
                  </button>
                </div>
              </div>
            )}

            {toolTab === 'shapes' && (
              <div>
                <div className="lms-pe-panel-head">
                  <strong>Shapes</strong>
                  <span>Click to add</span>
                </div>
                <div className="lms-pe-shape-grid">
                  <button
                    type="button"
                    onClick={() =>
                      addElementToSlide(createShapeElement('rect', deck.theme))
                    }
                  >
                    <span className="lms-pe-shape-sample is-rect" />
                    Rectangle
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addElementToSlide(createShapeElement('ellipse', deck.theme))
                    }
                  >
                    <span className="lms-pe-shape-sample is-circle" />
                    Circle
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addElementToSlide(createShapeElement('line', deck.theme))
                    }
                  >
                    <span className="lms-pe-shape-sample is-line" />
                    Line
                  </button>
                </div>
              </div>
            )}

            {toolTab === 'uploads' && (
              <div>
                <div className="lms-pe-panel-head">
                  <strong>Uploads</strong>
                  <span>Images only</span>
                </div>
                <button
                  type="button"
                  className="lms-pe-upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span>
                    <Icon name="upload" size={22} />
                  </span>
                  <strong>Upload an image</strong>
                  <small>PNG, JPG, GIF, or WebP up to 4 MB</small>
                </button>
                <input
                  ref={fileInputRef}
                  className="lms-pe-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                />
                {selectedElement?.type === 'image' && (
                  <p className="lms-pe-tool-note">
                    The selected image can be resized, rotated, or fitted from the
                    properties panel.
                  </p>
                )}
              </div>
            )}

            {toolTab === 'backgrounds' && (
              <div>
                <div className="lms-pe-panel-head">
                  <strong>Backgrounds</strong>
                  <span>Current slide</span>
                </div>
                <div className="lms-pe-backgrounds">
                  {SLIDE_BACKGROUNDS.map((background) => (
                    <button
                      key={background.label}
                      type="button"
                      className="lms-pe-background"
                      onClick={() =>
                        updateSlide({ background: background.value })
                      }
                      title={background.label}
                    >
                      <span
                        style={{ background: backgroundCss(background.value) }}
                      />
                      <small>{background.label}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="lms-pe-workspace">
          <div className="lms-pe-canvas-head">
            <div>
              <span className="lms-pe-slide-number">
                Slide {activeIndex + 1}
              </span>
              <span className="lms-pe-canvas-hint">
                Drag to move · corners to resize · top handle to rotate
              </span>
            </div>
            <div className="lms-pe-canvas-actions">
              <button
                type="button"
                className="lms-pe-icon-button"
                onClick={duplicateCurrentSlide}
                title="Duplicate slide"
                aria-label="Duplicate slide"
              >
                <Icon name="copy" size={16} />
              </button>
              <button
                type="button"
                className="lms-pe-icon-button"
                onClick={deleteCurrentSlide}
                title="Delete slide"
                aria-label="Delete slide"
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          </div>

          <div className="lms-pe-canvas-scroll">
            <div ref={canvasFitRef} className="lms-pe-canvas-fit">
              <div
                ref={stageRef}
                className="lms-pe-editor-stage"
                style={{
                  width: SLIDE_WIDTH,
                  height: SLIDE_HEIGHT,
                  background: backgroundCss(currentSlide?.background),
                  transform: `scale(${stageScale})`,
                  '--pe-scale': String(stageScale),
                }}
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) setSelectedId(null)
                }}
              >
                {currentSlide?.elements?.map((element) => {
                  const isSelected = selectedId === element.id
                  return (
                    <div
                      key={element.id}
                      className={`lms-pe-editor-element ${
                        isSelected ? 'is-selected' : ''
                      }`}
                      style={{
                        ...slideElementStyle(element),
                        zIndex: isSelected ? 20 : 1,
                      }}
                      onPointerDown={(event) => beginMove(event, element)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={endPointerInteraction}
                      onPointerCancel={endPointerInteraction}
                    >
                      <SlideElementBody element={element} />
                      {isSelected && (
                        <SelectionChrome
                          element={element}
                          onResize={beginResize}
                          onRotate={beginRotate}
                          onPointerMove={handlePointerMove}
                          onPointerUp={endPointerInteraction}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="lms-pe-slide-tray">
            <div className="lms-pe-slide-tray-scroll">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`lms-pe-slide-thumb ${
                    index === activeIndex ? 'is-active' : ''
                  }`}
                  onClick={() => {
                    setCurrentIndex(index)
                    setSelectedId(null)
                  }}
                  aria-label={`Go to slide ${index + 1}`}
                >
                  <SlideCanvas slide={slide} label={`Slide ${index + 1}`} />
                  <span>{index + 1}</span>
                </button>
              ))}
              <button
                type="button"
                className="lms-pe-add-thumb"
                onClick={addBlankSlide}
                aria-label="Add blank slide"
              >
                <Icon name="plus" size={20} />
                <span>New slide</span>
              </button>
            </div>
          </div>
        </main>

        <aside className="lms-pe-inspector" aria-label="Slide properties">
          {selectedElement ? (
            <ElementInspector
              element={selectedElement}
              theme={theme}
              onChange={updateSelected}
              onCommit={updateSelected}
              onSnapshot={snapshot}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onMoveLayer={moveLayer}
            />
          ) : (
            <SlideInspector
              slide={currentSlide}
              theme={theme}
              slideIndex={activeIndex}
              onBackground={(background) => updateSlide({ background })}
              onDuplicate={duplicateCurrentSlide}
              onDelete={deleteCurrentSlide}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

function SelectionChrome({
  element,
  onResize,
  onRotate,
  onPointerMove,
  onPointerUp,
}) {
  return (
    <>
      <span
        className="lms-pe-rotate-handle"
        style={{ left: element.w / 2 }}
        onPointerDown={(event) => onRotate(event, element)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-hidden="true"
      >
        <Icon name="rotate" size={14} />
      </span>
      {['nw', 'ne', 'se', 'sw'].map((handle) => (
        <span
          key={handle}
          className={`lms-pe-resize-handle is-${handle}`}
          onPointerDown={(event) => onResize(event, element, handle)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden="true"
        />
      ))}
    </>
  )
}

function FieldRow({ label, children }) {
  return (
    <label className="lms-pe-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function NumberField({ label, value, onChange, onSnapshot, min, max, step = 1 }) {
  return (
    <FieldRow label={label}>
      <input
        type="number"
        value={Math.round(value)}
        min={min}
        max={max}
        step={step}
        onFocus={onSnapshot}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </FieldRow>
  )
}

function SliderField({ label, value, onChange, onSnapshot, min, max, suffix = '' }) {
  return (
    <FieldRow label={`${label}${suffix ? ` · ${suffix}` : ''}`}>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        onPointerDown={onSnapshot}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </FieldRow>
  )
}

function ElementInspector({
  element,
  theme,
  onChange,
  onSnapshot,
  onDuplicate,
  onDelete,
  onMoveLayer,
}) {
  const update = (patch) => onChange(patch, { replaceOnly: true })
  const commit = (patch) => onChange(patch)

  return (
    <div className="lms-pe-inspector-inner">
      <div className="lms-pe-inspector-head">
        <div>
          <span>Selected element</span>
          <strong>
            {element.type === 'text'
              ? 'Text'
              : element.type === 'image'
                ? 'Image'
                : element.shape === 'ellipse'
                  ? 'Circle'
                  : element.shape === 'line'
                    ? 'Line'
                    : 'Rectangle'}
          </strong>
        </div>
        <div className="lms-pe-inspector-head-actions">
          <button
            type="button"
            className="lms-pe-mini-button"
            onClick={() => onMoveLayer(1)}
            title="Bring forward"
          >
            <Icon name="arrowUp" size={14} />
          </button>
          <button
            type="button"
            className="lms-pe-mini-button"
            onClick={() => onMoveLayer(-1)}
            title="Send backward"
          >
            <Icon name="arrowDown" size={14} />
          </button>
        </div>
      </div>

      {element.type === 'text' && (
        <div className="lms-pe-control-group">
          <FieldRow label="Text">
            <textarea
              rows="4"
              value={element.text}
              onFocus={onSnapshot}
              onChange={(event) => update({ text: event.target.value })}
            />
          </FieldRow>
          <div className="lms-pe-split-fields">
            <FieldRow label="Font">
              <select
                value={element.fontFamily}
                onChange={(event) => commit({ fontFamily: event.target.value })}
              >
                {PRESENTATION_FONTS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </FieldRow>
            <NumberField
              label="Size"
              value={element.fontSize}
              min={8}
              max={160}
              onSnapshot={onSnapshot}
              onChange={(fontSize) => update({ fontSize })}
            />
          </div>
          <div className="lms-pe-split-fields">
            <FieldRow label="Weight">
              <select
                value={element.fontWeight}
                onChange={(event) =>
                  commit({ fontWeight: Number(event.target.value) })
                }
              >
                <option value="400">Regular</option>
                <option value="500">Medium</option>
                <option value="600">Semibold</option>
                <option value="700">Bold</option>
                <option value="800">Extra bold</option>
              </select>
            </FieldRow>
            <FieldRow label="Color">
              <input
                type="color"
                value={element.color}
                onFocus={onSnapshot}
                onChange={(event) => update({ color: event.target.value })}
              />
            </FieldRow>
          </div>
          <FieldRow label="Alignment">
            <div className="lms-pe-segmented">
              {['left', 'center', 'right'].map((align) => (
                <button
                  key={align}
                  type="button"
                  className={element.align === align ? 'is-active' : ''}
                  onClick={() => commit({ align })}
                >
                  {align}
                </button>
              ))}
            </div>
          </FieldRow>
          <SliderField
            label="Line height"
            value={element.lineHeight}
            min={0.9}
            max={2.2}
            step={0.05}
            suffix={Number(element.lineHeight).toFixed(2)}
            onSnapshot={onSnapshot}
            onChange={(lineHeight) => update({ lineHeight })}
          />
        </div>
      )}

      {element.type === 'shape' && (
        <div className="lms-pe-control-group">
          {element.shape !== 'line' && (
            <FieldRow label="Fill">
              <input
                type="color"
                value={element.fill}
                onFocus={onSnapshot}
                onChange={(event) => update({ fill: event.target.value })}
              />
            </FieldRow>
          )}
          <div className="lms-pe-split-fields">
            <FieldRow label="Stroke">
              <input
                type="color"
                value={element.stroke || '#7c3aed'}
                onFocus={onSnapshot}
                onChange={(event) => update({ stroke: event.target.value })}
              />
            </FieldRow>
            <NumberField
              label="Width"
              value={element.strokeWidth || 0}
              min={0}
              max={40}
              onSnapshot={onSnapshot}
              onChange={(strokeWidth) => update({ strokeWidth })}
            />
          </div>
          {element.shape !== 'line' && (
            <NumberField
              label="Corner radius"
              value={element.radius || 0}
              min={0}
              max={200}
              onSnapshot={onSnapshot}
              onChange={(radius) => update({ radius })}
            />
          )}
        </div>
      )}

      {element.type === 'image' && (
        <div className="lms-pe-control-group">
          <FieldRow label="Image fit">
            <select
              value={element.fit || 'cover'}
              onChange={(event) => commit({ fit: event.target.value })}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Stretch</option>
            </select>
          </FieldRow>
          <NumberField
            label="Corner radius"
            value={element.radius || 0}
            min={0}
            max={200}
            onSnapshot={onSnapshot}
            onChange={(radius) => update({ radius })}
          />
          <p className="lms-pe-tool-note">
            Uploaded images are stored with this presentation. Use resize handles
            to change the frame.
          </p>
        </div>
      )}

      <div className="lms-pe-control-group">
        <div className="lms-pe-section-title">Layout</div>
        <div className="lms-pe-position-grid">
          <NumberField
            label="X"
            value={element.x}
            onSnapshot={onSnapshot}
            onChange={(x) => update({ x })}
          />
          <NumberField
            label="Y"
            value={element.y}
            onSnapshot={onSnapshot}
            onChange={(y) => update({ y })}
          />
          <NumberField
            label="W"
            value={element.w}
            min={20}
            onSnapshot={onSnapshot}
            onChange={(w) => update({ w })}
          />
          <NumberField
            label="H"
            value={element.h}
            min={20}
            onSnapshot={onSnapshot}
            onChange={(h) => update({ h })}
          />
        </div>
        <SliderField
          label="Rotation"
          value={element.rotation || 0}
          min={-180}
          max={180}
          suffix={`${Math.round(element.rotation || 0)}°`}
          onSnapshot={onSnapshot}
          onChange={(rotation) => update({ rotation })}
        />
        <SliderField
          label="Opacity"
          value={element.opacity ?? 1}
          min={0.1}
          max={1}
          step={0.05}
          suffix={`${Math.round((element.opacity ?? 1) * 100)}%`}
          onSnapshot={onSnapshot}
          onChange={(opacity) => update({ opacity })}
        />
      </div>

      <div className="lms-pe-inspector-actions">
        <button type="button" className="lms-pe-button" onClick={onDuplicate}>
          <Icon name="copy" size={14} />
          Duplicate
        </button>
        <button
          type="button"
          className="lms-pe-button is-danger"
          onClick={onDelete}
        >
          <Icon name="trash" size={14} />
          Delete
        </button>
      </div>
      <p className="lms-pe-theme-note">
        Deck accent: <span style={{ background: theme.accent }} /> {theme.label}
      </p>
    </div>
  )
}

function SlideInspector({
  slide,
  theme,
  slideIndex,
  onBackground,
  onDuplicate,
  onDelete,
}) {
  return (
    <div className="lms-pe-inspector-inner">
      <div className="lms-pe-inspector-head">
        <div>
          <span>Slide properties</span>
          <strong>Slide {slideIndex + 1}</strong>
        </div>
      </div>

      <div className="lms-pe-control-group">
        <div className="lms-pe-section-title">Background</div>
        <div className="lms-pe-backgrounds is-inspector">
          {SLIDE_BACKGROUNDS.map((background) => (
            <button
              key={background.label}
              type="button"
              className="lms-pe-background"
              onClick={() => onBackground(background.value)}
              title={background.label}
            >
              <span style={{ background: backgroundCss(background.value) }} />
              <small>{background.label}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="lms-pe-control-group">
        <div className="lms-pe-section-title">Slide canvas</div>
        <div className="lms-pe-canvas-size">
          <span>16:9 widescreen</span>
          <strong>
            {SLIDE_WIDTH} × {SLIDE_HEIGHT} px
          </strong>
        </div>
        <div className="lms-pe-layer-summary">
          <Icon name="layers" size={17} />
          <span>
            {slide?.elements?.length || 0} element
            {slide?.elements?.length === 1 ? '' : 's'} on this slide
          </span>
        </div>
      </div>

      <div className="lms-pe-control-group">
        <div className="lms-pe-section-title">Theme</div>
        <div className="lms-pe-theme-card">
          <span style={{ background: theme.accent }} />
          <div>
            <strong>{theme.label}</strong>
            <small>Used across this presentation</small>
          </div>
        </div>
      </div>

      <div className="lms-pe-inspector-actions">
        <button type="button" className="lms-pe-button" onClick={onDuplicate}>
          <Icon name="copy" size={14} />
          Duplicate slide
        </button>
        <button
          type="button"
          className="lms-pe-button is-danger"
          onClick={onDelete}
        >
          <Icon name="trash" size={14} />
          Delete slide
        </button>
      </div>
    </div>
  )
}
