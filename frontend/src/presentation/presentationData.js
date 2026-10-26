import { studentLessons } from '../data/sampleData.js'

export const SLIDE_WIDTH = 1280
export const SLIDE_HEIGHT = 720

export const PRESENTATION_FONTS = [
  { label: 'Manrope', value: 'Manrope' },
  { label: 'DM Sans', value: 'DM Sans' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Courier New', value: 'Courier New' },
]

export const PRESENTATION_THEMES = {
  violet: {
    label: 'Violet',
    accent: '#7c3aed',
    accentSoft: '#ede9fe',
    ink: '#211a36',
    muted: '#675b83',
    surface: '#ffffff',
    soft: '#f1ebff',
    background: { type: 'gradient', from: '#fbf8ff', to: '#eee7ff', angle: 135 },
  },
  blue: {
    label: 'Ocean',
    accent: '#2563eb',
    accentSoft: '#dbeafe',
    ink: '#14233d',
    muted: '#5b6b86',
    surface: '#ffffff',
    soft: '#eaf1ff',
    background: { type: 'gradient', from: '#f7faff', to: '#e9f1ff', angle: 135 },
  },
  teal: {
    label: 'Mint',
    accent: '#0f766e',
    accentSoft: '#ccfbf1',
    ink: '#132b2a',
    muted: '#56716e',
    surface: '#ffffff',
    soft: '#e6faf6',
    background: { type: 'gradient', from: '#f5fffc', to: '#e2f7f2', angle: 135 },
  },
  sunset: {
    label: 'Sunset',
    accent: '#ea580c',
    accentSoft: '#ffedd5',
    ink: '#321b10',
    muted: '#7f6253',
    surface: '#fffaf5',
    soft: '#fff1e6',
    background: { type: 'gradient', from: '#fffaf5', to: '#ffead9', angle: 135 },
  },
  midnight: {
    label: 'Midnight',
    accent: '#a78bfa',
    accentSoft: '#312e81',
    ink: '#f8fafc',
    muted: '#b7c0d8',
    surface: '#24204a',
    soft: '#2e2a58',
    background: { type: 'gradient', from: '#111827', to: '#312e81', angle: 135 },
  },
}

export const SLIDE_BACKGROUNDS = [
  { label: 'White', value: { type: 'solid', color: '#ffffff' } },
  { label: 'Paper', value: { type: 'solid', color: '#f8f7fc' } },
  { label: 'Lavender', value: { type: 'gradient', from: '#fbf8ff', to: '#e9e0ff', angle: 135 } },
  { label: 'Sky', value: { type: 'gradient', from: '#f7fbff', to: '#dbeafe', angle: 135 } },
  { label: 'Mint', value: { type: 'gradient', from: '#f5fffc', to: '#d8f5ee', angle: 135 } },
  { label: 'Peach', value: { type: 'gradient', from: '#fffaf5', to: '#ffe5cf', angle: 135 } },
  { label: 'Midnight', value: { type: 'gradient', from: '#111827', to: '#312e81', angle: 135 } },
  { label: 'Ink', value: { type: 'solid', color: '#15172b' } },
]

export const TEMPLATE_CATALOG = [
  { id: 'title', label: 'Title', hint: 'Opening slide' },
  { id: 'bullets', label: 'Key points', hint: 'Three talking points' },
  { id: 'split', label: 'Split', hint: 'Text and visual' },
  { id: 'quote', label: 'Quote', hint: 'Big statement' },
  { id: 'section', label: 'Section', hint: 'Chapter break' },
  { id: 'blank', label: 'Blank', hint: 'Start from scratch' },
]

const SUBJECT_THEMES = {
  'cs-101': 'violet',
  'math-201': 'blue',
  'it-210': 'teal',
}

export const createId = (prefix = 'id') => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const getPresentationTheme = (key) =>
  PRESENTATION_THEMES[key] || PRESENTATION_THEMES.violet

export const backgroundCss = (background) => {
  if (!background) return '#ffffff'
  if (background.type === 'gradient') {
    return `linear-gradient(${background.angle || 135}deg, ${background.from}, ${background.to})`
  }
  return background.color || '#ffffff'
}

export const isDarkBackground = (background) => {
  if (!background) return false
  const color = background.type === 'gradient' ? background.from : background.color
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return false
  const red = parseInt(color.slice(1, 3), 16)
  const green = parseInt(color.slice(3, 5), 16)
  const blue = parseInt(color.slice(5, 7), 16)
  return (red * 299 + green * 587 + blue * 114) / 1000 < 110
}

const textElement = ({
  x,
  y,
  w,
  h,
  text,
  theme,
  fontSize = 24,
  fontWeight = 500,
  color,
  align = 'left',
  lineHeight = 1.35,
  letterSpacing = 0,
}) => ({
  id: createId('el'),
  type: 'text',
  x,
  y,
  w,
  h,
  rotation: 0,
  opacity: 1,
  text,
  fontSize,
  fontWeight,
  fontFamily: 'Manrope',
  color: color || theme.ink,
  align,
  lineHeight,
  letterSpacing,
})

const shapeElement = ({
  x,
  y,
  w,
  h,
  fill,
  theme,
  shape = 'rect',
  radius = 0,
  stroke = 'transparent',
  strokeWidth = 0,
  opacity = 1,
  rotation = 0,
}) => ({
  id: createId('el'),
  type: 'shape',
  shape,
  x,
  y,
  w,
  h,
  rotation,
  opacity,
  fill: fill || theme.accent,
  stroke,
  strokeWidth,
  radius,
})

export const createTextElement = (overrides = {}) => {
  const theme = getPresentationTheme(overrides.themeKey)
  return {
    ...textElement({
      x: 120,
      y: 120,
      w: 640,
      h: 120,
      text: overrides.text || 'Add your text',
      theme,
      fontSize: overrides.fontSize || 32,
      fontWeight: overrides.fontWeight || 600,
      color: overrides.color,
      align: overrides.align || 'left',
      lineHeight: overrides.lineHeight || 1.3,
    }),
    ...overrides,
  }
}

export const createShapeElement = (shape = 'rect', themeKey = 'violet') => {
  const theme = getPresentationTheme(themeKey)
  return shapeElement({
    x: 180,
    y: 170,
    w: 260,
    h: 180,
    fill: shape === 'line' ? 'transparent' : theme.accent,
    theme,
    shape,
    radius: shape === 'rect' ? 18 : 0,
    stroke: shape === 'line' ? theme.accent : 'transparent',
    strokeWidth: shape === 'line' ? 8 : 0,
    opacity: shape === 'line' ? 1 : 0.9,
  })
}

export const createImageElement = (src, overrides = {}) => ({
  id: createId('el'),
  type: 'image',
  x: 720,
  y: 150,
  w: 430,
  h: 300,
  rotation: 0,
  opacity: 1,
  src,
  fit: 'cover',
  radius: 20,
  ...overrides,
})

const titleSlide = ({ title, subtitle, subjectCode, themeKey }) => {
  const theme = getPresentationTheme(themeKey)
  return {
    id: createId('slide'),
    background: theme.background,
    elements: [
      shapeElement({
        x: 1000,
        y: 80,
        w: 240,
        h: 240,
        fill: theme.accent,
        theme,
        shape: 'ellipse',
        opacity: 0.12,
      }),
      shapeElement({
        x: 1110,
        y: 300,
        w: 92,
        h: 92,
        fill: theme.accent,
        theme,
        shape: 'ellipse',
        opacity: 0.18,
      }),
      shapeElement({
        x: 96,
        y: 118,
        w: 64,
        h: 8,
        fill: theme.accent,
        theme,
        radius: 4,
      }),
      textElement({
        x: 96,
        y: 148,
        w: 720,
        h: 32,
        text: `${subjectCode || 'LEARNSPACE'} · LESSON DECK`,
        theme,
        fontSize: 18,
        fontWeight: 800,
        color: theme.accent,
        letterSpacing: 2.2,
      }),
      textElement({
        x: 96,
        y: 196,
        w: 910,
        h: 190,
        text: title,
        theme,
        fontSize: title.length > 40 ? 58 : 66,
        fontWeight: 800,
        lineHeight: 1.06,
      }),
      textElement({
        x: 96,
        y: 408,
        w: 790,
        h: 112,
        text: subtitle,
        theme,
        fontSize: 23,
        fontWeight: 500,
        color: theme.muted,
        lineHeight: 1.45,
      }),
      textElement({
        x: 96,
        y: 626,
        w: 700,
        h: 26,
        text: 'LearnSpace · Faculty presentation',
        theme,
        fontSize: 15,
        fontWeight: 600,
        color: theme.muted,
      }),
    ],
    notes: '',
  }
}

const splitSentences = (content) =>
  (content.match(/[^.!?]+[.!?]+/g) || [content])
    .map((sentence) => sentence.trim())
    .filter(Boolean)

const buildLessonSlides = (lesson, themeKey) => {
  const theme = getPresentationTheme(themeKey)
  const paragraphs = lesson.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const sentences = splitSentences(lesson.content)
  const bullets = sentences.slice(0, 3)
  const leftBody = paragraphs[1] || sentences[3] || lesson.summary
  const rightBody = paragraphs[2] || sentences[4] || lesson.summary
  const quote =
    sentences.find((sentence) => sentence.length > 70) || lesson.summary

  return [
    titleSlide({
      title: lesson.title,
      subtitle: lesson.summary,
      subjectCode: lesson.subjectCode,
      themeKey,
    }),
    {
      id: createId('slide'),
      background: theme.background,
      elements: [
        textElement({
          x: 96,
          y: 96,
          w: 700,
          h: 30,
          text: 'IN THIS LESSON',
          theme,
          fontSize: 17,
          fontWeight: 800,
          color: theme.accent,
          letterSpacing: 2,
        }),
        textElement({
          x: 96,
          y: 138,
          w: 840,
          h: 74,
          text: "What you'll learn",
          theme,
          fontSize: 46,
          fontWeight: 800,
          lineHeight: 1.1,
        }),
        textElement({
          x: 96,
          y: 236,
          w: 860,
          h: 96,
          text: lesson.summary,
          theme,
          fontSize: 23,
          fontWeight: 500,
          color: theme.muted,
          lineHeight: 1.45,
        }),
        ...bullets.flatMap((bullet, index) => [
          shapeElement({
            x: 100,
            y: 388 + index * 78,
            w: 16,
            h: 16,
            fill: theme.accent,
            theme,
            shape: 'ellipse',
            opacity: 1,
          }),
          textElement({
            x: 136,
            y: 378 + index * 78,
            w: 960,
            h: 58,
            text: bullet,
            theme,
            fontSize: 21,
            fontWeight: 500,
            lineHeight: 1.4,
          }),
        ]),
        shapeElement({
          x: 1110,
          y: 370,
          w: 74,
          h: 230,
          fill: theme.accent,
          theme,
          radius: 37,
          opacity: 0.1,
        }),
      ],
      notes: '',
    },
    {
      id: createId('slide'),
      background: theme.background,
      elements: [
        textElement({
          x: 96,
          y: 96,
          w: 700,
          h: 30,
          text: 'KEY CONCEPTS',
          theme,
          fontSize: 17,
          fontWeight: 800,
          color: theme.accent,
          letterSpacing: 2,
        }),
        textElement({
          x: 96,
          y: 138,
          w: 900,
          h: 74,
          text: 'The big ideas',
          theme,
          fontSize: 46,
          fontWeight: 800,
          lineHeight: 1.1,
        }),
        shapeElement({
          x: 96,
          y: 246,
          w: 512,
          h: 330,
          fill: theme.surface,
          theme,
          radius: 24,
          opacity: 0.82,
        }),
        shapeElement({
          x: 672,
          y: 246,
          w: 512,
          h: 330,
          fill: theme.surface,
          theme,
          radius: 24,
          opacity: 0.82,
        }),
        shapeElement({
          x: 128,
          y: 278,
          w: 52,
          h: 6,
          fill: theme.accent,
          theme,
          radius: 3,
        }),
        shapeElement({
          x: 704,
          y: 278,
          w: 52,
          h: 6,
          fill: theme.accent,
          theme,
          radius: 3,
        }),
        textElement({
          x: 128,
          y: 312,
          w: 448,
          h: 228,
          text: leftBody,
          theme,
          fontSize: 20,
          fontWeight: 500,
          lineHeight: 1.6,
        }),
        textElement({
          x: 704,
          y: 312,
          w: 448,
          h: 228,
          text: rightBody,
          theme,
          fontSize: 20,
          fontWeight: 500,
          lineHeight: 1.6,
        }),
      ],
      notes: '',
    },
    {
      id: createId('slide'),
      background: theme.background,
      elements: [
        shapeElement({
          x: 118,
          y: 112,
          w: 92,
          h: 92,
          fill: theme.accent,
          theme,
          shape: 'ellipse',
          opacity: 0.9,
        }),
        textElement({
          x: 140,
          y: 130,
          w: 48,
          h: 50,
          text: '“',
          theme,
          fontSize: 56,
          fontWeight: 800,
          color: theme.surface,
          align: 'center',
        }),
        textElement({
          x: 118,
          y: 250,
          w: 970,
          h: 230,
          text: quote,
          theme,
          fontSize: 38,
          fontWeight: 700,
          lineHeight: 1.35,
        }),
        shapeElement({
          x: 118,
          y: 534,
          w: 96,
          h: 6,
          fill: theme.accent,
          theme,
          radius: 3,
        }),
        textElement({
          x: 118,
          y: 564,
          w: 720,
          h: 32,
          text: `${lesson.subjectCode} · ${lesson.title}`,
          theme,
          fontSize: 17,
          fontWeight: 700,
          color: theme.muted,
        }),
      ],
      notes: '',
    },
  ]
}

export const buildPresentationFromLesson = (lesson) => {
  const sourceFile =
    typeof lesson.presentation === 'string'
      ? lesson.presentation
      : lesson.presentation?.name || ''
  const themeKey = SUBJECT_THEMES[lesson.subjectId] || 'violet'
  const timestamp = new Date().toISOString()

  return {
    id: `deck-${lesson.id}`,
    title: lesson.title,
    description: lesson.summary || '',
    subjectCode: lesson.subjectCode || 'General',
    sourceFile,
    lessonId: lesson.id,
    theme: themeKey,
    slides: buildLessonSlides(lesson, themeKey),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export const PRESENTATION_SEEDS = studentLessons.map(buildPresentationFromLesson)

export const buildTemplateSlide = (templateId, themeKey = 'violet') => {
  const theme = getPresentationTheme(themeKey)
  if (templateId === 'title') {
    return titleSlide({
      title: 'A clear, focused title',
      subtitle: 'Add a short description to set up the lesson for your students.',
      subjectCode: 'LEARNSPACE',
      themeKey,
    })
  }

  if (templateId === 'bullets') {
    return {
      id: createId('slide'),
      background: theme.background,
      elements: [
        textElement({
          x: 96,
          y: 96,
          w: 700,
          h: 30,
          text: 'KEY POINTS',
          theme,
          fontSize: 17,
          fontWeight: 800,
          color: theme.accent,
          letterSpacing: 2,
        }),
        textElement({
          x: 96,
          y: 138,
          w: 860,
          h: 80,
          text: 'What students should remember',
          theme,
          fontSize: 44,
          fontWeight: 800,
          lineHeight: 1.12,
        }),
        ...[
          'Start with the most important idea.',
          'Support it with a clear example.',
          'Close with one action students can take.',
        ].flatMap((text, index) => [
          shapeElement({
            x: 104,
            y: 308 + index * 92,
            w: 18,
            h: 18,
            fill: theme.accent,
            theme,
            shape: 'ellipse',
          }),
          textElement({
            x: 146,
            y: 294 + index * 92,
            w: 920,
            h: 60,
            text,
            theme,
            fontSize: 25,
            fontWeight: 500,
            lineHeight: 1.35,
          }),
        ]),
      ],
      notes: '',
    }
  }

  if (templateId === 'split') {
    return {
      id: createId('slide'),
      background: theme.background,
      elements: [
        textElement({
          x: 96,
          y: 96,
          w: 700,
          h: 30,
          text: 'EXPLORE THE IDEA',
          theme,
          fontSize: 17,
          fontWeight: 800,
          color: theme.accent,
          letterSpacing: 2,
        }),
        textElement({
          x: 96,
          y: 144,
          w: 600,
          h: 110,
          text: 'A heading with room to explain',
          theme,
          fontSize: 43,
          fontWeight: 800,
          lineHeight: 1.12,
        }),
        textElement({
          x: 96,
          y: 288,
          w: 530,
          h: 250,
          text: 'Use this space for context, a short explanation, or a question that prepares students for the example on the right.',
          theme,
          fontSize: 21,
          fontWeight: 500,
          color: theme.muted,
          lineHeight: 1.6,
        }),
        shapeElement({
          x: 690,
          y: 140,
          w: 494,
          h: 440,
          fill: theme.accentSoft,
          theme,
          radius: 26,
          opacity: 0.9,
        }),
        shapeElement({
          x: 778,
          y: 220,
          w: 318,
          h: 280,
          fill: theme.surface,
          theme,
          radius: 22,
          opacity: 0.75,
        }),
        textElement({
          x: 818,
          y: 300,
          w: 238,
          h: 120,
          text: 'Add an image, diagram, or key takeaway here.',
          theme,
          fontSize: 22,
          fontWeight: 700,
          color: theme.muted,
          align: 'center',
          lineHeight: 1.4,
        }),
      ],
      notes: '',
    }
  }

  if (templateId === 'quote') {
    return {
      id: createId('slide'),
      background: theme.background,
      elements: [
        textElement({
          x: 120,
          y: 88,
          w: 80,
          h: 90,
          text: '“',
          theme,
          fontSize: 120,
          fontWeight: 800,
          color: theme.accent,
          lineHeight: 1,
        }),
        textElement({
          x: 120,
          y: 214,
          w: 1000,
          h: 220,
          text: 'A strong statement can make the main idea impossible to forget.',
          theme,
          fontSize: 42,
          fontWeight: 700,
          lineHeight: 1.3,
        }),
        shapeElement({
          x: 120,
          y: 492,
          w: 94,
          h: 6,
          fill: theme.accent,
          theme,
          radius: 3,
        }),
        textElement({
          x: 120,
          y: 522,
          w: 720,
          h: 32,
          text: 'Add the source or a short explanation',
          theme,
          fontSize: 17,
          fontWeight: 700,
          color: theme.muted,
        }),
      ],
      notes: '',
    }
  }

  if (templateId === 'section') {
    return {
      id: createId('slide'),
      background: theme.background,
      elements: [
        shapeElement({
          x: 96,
          y: 120,
          w: 8,
          h: 260,
          fill: theme.accent,
          theme,
          radius: 4,
        }),
        textElement({
          x: 144,
          y: 122,
          w: 300,
          h: 80,
          text: '01',
          theme,
          fontSize: 66,
          fontWeight: 800,
          color: theme.accent,
          lineHeight: 1,
        }),
        textElement({
          x: 144,
          y: 230,
          w: 900,
          h: 100,
          text: 'Start a new section',
          theme,
          fontSize: 52,
          fontWeight: 800,
          lineHeight: 1.1,
        }),
        textElement({
          x: 144,
          y: 350,
          w: 720,
          h: 60,
          text: 'Use a section slide to slow down and signal a change in topic.',
          theme,
          fontSize: 22,
          fontWeight: 500,
          color: theme.muted,
          lineHeight: 1.45,
        }),
      ],
      notes: '',
    }
  }

  return {
    id: createId('slide'),
    background: theme.background,
    elements: [],
    notes: '',
  }
}

export const createBlankPresentation = ({
  title,
  subjectCode = 'General',
  theme = 'violet',
  sourceFile = '',
  lessonId = null,
}) => {
  const timestamp = new Date().toISOString()
  const presentationTitle = title?.trim() || 'Untitled presentation'
  return {
    id: createId('deck'),
    title: presentationTitle,
    description: 'A new presentation created in LearnSpace.',
    subjectCode,
    sourceFile,
    lessonId,
    theme,
    slides: [
      titleSlide({
        title: presentationTitle,
        subtitle: 'Add a short description to introduce this presentation.',
        subjectCode,
        themeKey: theme,
      }),
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export const duplicatePresentation = (presentation) => {
  const timestamp = new Date().toISOString()
  return {
    ...presentation,
    id: createId('deck'),
    title: `${presentation.title} copy`,
    slides: presentation.slides.map((slide) => ({
      ...slide,
      id: createId('slide'),
      elements: slide.elements.map((element) => ({
        ...element,
        id: createId('el'),
      })),
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export const duplicateSlide = (slide) => ({
  ...slide,
  id: createId('slide'),
  elements: slide.elements.map((element) => ({
    ...element,
    id: createId('el'),
  })),
})

export const createEmptySlide = (themeKey = 'violet') => ({
  id: createId('slide'),
  background: getPresentationTheme(themeKey).background,
  elements: [],
  notes: '',
})
