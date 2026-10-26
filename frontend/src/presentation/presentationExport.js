import { SLIDE_HEIGHT, SLIDE_WIDTH } from './presentationData.js'

const safeFileName = (value) =>
  (value || 'presentation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'presentation'

const roundedRect = (context, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius || 0, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  )
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

const drawBackground = (context, background) => {
  if (background?.type === 'gradient') {
    const angle = ((background.angle || 135) * Math.PI) / 180
    const centerX = SLIDE_WIDTH / 2
    const centerY = SLIDE_HEIGHT / 2
    const length =
      Math.abs(SLIDE_WIDTH * Math.cos(angle)) +
      Math.abs(SLIDE_HEIGHT * Math.sin(angle))
    const gradient = context.createLinearGradient(
      centerX - (Math.cos(angle) * length) / 2,
      centerY - (Math.sin(angle) * length) / 2,
      centerX + (Math.cos(angle) * length) / 2,
      centerY + (Math.sin(angle) * length) / 2,
    )
    gradient.addColorStop(0, background.from)
    gradient.addColorStop(1, background.to)
    context.fillStyle = gradient
  } else {
    context.fillStyle = background?.color || '#ffffff'
  }
  context.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT)
}

const wrapText = (context, text, maxWidth) => {
  const lines = []
  String(text || '')
    .split('\n')
    .forEach((paragraph) => {
      if (!paragraph) {
        lines.push('')
        return
      }
      const words = paragraph.split(/\s+/)
      let line = ''
      words.forEach((word) => {
        const nextLine = line ? `${line} ${word}` : word
        if (context.measureText(nextLine).width > maxWidth && line) {
          lines.push(line)
          line = word
        } else {
          line = nextLine
        }
      })
      if (line) lines.push(line)
    })
  return lines
}

const drawText = (context, element) => {
  const fontWeight = element.fontWeight || 500
  const fontSize = element.fontSize || 24
  context.font = `${fontWeight} ${fontSize}px '${element.fontFamily || 'Manrope'}', sans-serif`
  context.fillStyle = element.color || '#17243a'
  context.textBaseline = 'top'
  context.textAlign =
    element.align === 'center'
      ? 'center'
      : element.align === 'right'
        ? 'right'
        : 'left'

  const lines = wrapText(context, element.text, element.w)
  const lineHeight = fontSize * (element.lineHeight || 1.3)
  const x =
    element.align === 'center'
      ? 0
      : element.align === 'right'
        ? element.w / 2
        : -element.w / 2

  lines.forEach((line, index) => {
    context.fillText(line, x, -element.h / 2 + index * lineHeight)
  })
}

const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) {
      resolve(null)
      return
    }
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })

const drawImageFitted = (context, image, element) => {
  const width = element.w
  const height = element.h
  const fit = element.fit || 'cover'

  if (fit === 'fill') {
    context.drawImage(image, -width / 2, -height / 2, width, height)
    return
  }

  const imageRatio = image.width / image.height
  const boxRatio = width / height

  if (fit === 'contain') {
    const fittedWidth = imageRatio > boxRatio ? width : height * imageRatio
    const fittedHeight = imageRatio > boxRatio ? width / imageRatio : height
    context.drawImage(
      image,
      -fittedWidth / 2,
      -fittedHeight / 2,
      fittedWidth,
      fittedHeight,
    )
    return
  }

  let sourceX = 0
  let sourceY = 0
  let sourceWidth = image.width
  let sourceHeight = image.height

  if (imageRatio > boxRatio) {
    sourceWidth = image.height * boxRatio
    sourceX = (image.width - sourceWidth) / 2
  } else {
    sourceHeight = image.width / boxRatio
    sourceY = (image.height - sourceHeight) / 2
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    -width / 2,
    -height / 2,
    width,
    height,
  )
}

export const renderSlideToCanvas = async (slide, scale = 2) => {
  const canvas = document.createElement('canvas')
  canvas.width = SLIDE_WIDTH * scale
  canvas.height = SLIDE_HEIGHT * scale
  const context = canvas.getContext('2d')
  context.scale(scale, scale)
  drawBackground(context, slide?.background)

  const imageElements = (slide?.elements || []).filter(
    (element) => element.type === 'image' && element.src,
  )
  const images = new Map(
    await Promise.all(
      imageElements.map(async (element) => [
        element.id,
        await loadImage(element.src),
      ]),
    ),
  )

  for (const element of slide?.elements || []) {
    context.save()
    context.globalAlpha = element.opacity ?? 1
    context.translate(
      element.x + element.w / 2,
      element.y + element.h / 2,
    )
    context.rotate(((element.rotation || 0) * Math.PI) / 180)

    if (element.type === 'text') {
      drawText(context, element)
    } else if (element.type === 'image') {
      const image = images.get(element.id)
      if (image) {
        context.save()
        roundedRect(
          context,
          -element.w / 2,
          -element.h / 2,
          element.w,
          element.h,
          element.radius || 0,
        )
        context.clip()
        drawImageFitted(context, image, element)
        context.restore()
      }
    } else if (element.shape === 'ellipse') {
      context.beginPath()
      context.ellipse(0, 0, element.w / 2, element.h / 2, 0, 0, Math.PI * 2)
      context.fillStyle = element.fill || '#7c3aed'
      context.fill()
      if (element.strokeWidth && element.stroke) {
        context.lineWidth = element.strokeWidth
        context.strokeStyle = element.stroke
        context.stroke()
      }
    } else if (element.shape === 'line') {
      context.beginPath()
      context.moveTo(-element.w / 2, 0)
      context.lineTo(element.w / 2, 0)
      context.lineWidth = element.strokeWidth || 4
      context.strokeStyle = element.stroke || element.fill || '#7c3aed'
      context.lineCap = 'round'
      context.stroke()
    } else {
      roundedRect(
        context,
        -element.w / 2,
        -element.h / 2,
        element.w,
        element.h,
        element.radius || 0,
      )
      context.fillStyle = element.fill || '#7c3aed'
      context.fill()
      if (element.strokeWidth && element.stroke) {
        context.lineWidth = element.strokeWidth
        context.strokeStyle = element.stroke
        context.stroke()
      }
    }

    context.restore()
  }

  return canvas
}

export const renderSlideToDataUrl = async (slide, scale = 2) => {
  const canvas = await renderSlideToCanvas(slide, scale)
  return canvas.toDataURL('image/png')
}

const downloadUrl = (url, fileName) => {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export const exportSlidePng = async (presentation, slide, index) => {
  const dataUrl = await renderSlideToDataUrl(slide, 2)
  downloadUrl(
    dataUrl,
    `${safeFileName(presentation.title)}-slide-${index + 1}.png`,
  )
}

export const exportPresentationJson = (presentation) => {
  const blob = new Blob([JSON.stringify(presentation, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  downloadUrl(url, `${safeFileName(presentation.title)}.json`)
  URL.revokeObjectURL(url)
}

export const printPresentation = async (presentation) => {
  const images = await Promise.all(
    presentation.slides.map((slide) => renderSlideToDataUrl(slide, 1.6)),
  )
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Allow pop-ups to print this presentation.')
  }

  const pages = images
    .map(
      (dataUrl, index) =>
        `<figure><img src="${dataUrl}" alt="Slide ${index + 1}" /></figure>`,
    )
    .join('')
  const title = String(presentation.title || 'Presentation').replace(
    /[<>&"]/g,
    (character) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[character],
  )

  printWindow.document.write(
    `<!doctype html><html><head><title>${title}</title><style>
      @page { size: 13.333in 7.5in; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #ffffff; }
      figure { display: grid; width: 13.333in; height: 7.5in; margin: 0; page-break-after: always; place-items: center; }
      figure:last-child { page-break-after: auto; }
      img { display: block; width: 100%; height: 100%; object-fit: contain; }
    </style></head><body>${pages}<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 350); });</script></body></html>`,
  )
  printWindow.document.close()
  printWindow.focus()
}
