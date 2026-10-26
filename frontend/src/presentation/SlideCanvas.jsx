import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  backgroundCss,
} from './presentationData.js'
import { slideElementStyle, useSlideScale } from './slideCanvasUtils.js'
import './Presentation.css'

export function SlideElementBody({ element }) {
  if (element.type === 'text') {
    return (
      <div
        className="lms-pe-slide-text"
        style={{
          color: element.color,
          fontSize: element.fontSize,
          fontFamily: `'${element.fontFamily || 'Manrope'}', sans-serif`,
          fontWeight: element.fontWeight,
          textAlign: element.align,
          lineHeight: element.lineHeight,
          letterSpacing: `${element.letterSpacing || 0}px`,
        }}
      >
        {element.text}
      </div>
    )
  }

  if (element.type === 'image') {
    return element.src ? (
      <img
        className="lms-pe-slide-image"
        src={element.src}
        alt=""
        draggable="false"
        style={{
          objectFit: element.fit || 'cover',
          borderRadius: element.radius || 0,
        }}
      />
    ) : (
      <div className="lms-pe-slide-image-empty">Image</div>
    )
  }

  if (element.shape === 'ellipse') {
    return (
      <div
        className="lms-pe-slide-shape"
        style={{
          borderRadius: '50%',
          background: element.fill,
          border: element.strokeWidth
            ? `${element.strokeWidth}px solid ${element.stroke}`
            : 'none',
        }}
      />
    )
  }

  if (element.shape === 'line') {
    return (
      <div
        className="lms-pe-slide-shape"
        style={{
          top: '50%',
          height: element.strokeWidth || 4,
          transform: 'translateY(-50%)',
          borderRadius: (element.strokeWidth || 4) / 2,
          background: element.stroke || element.fill,
        }}
      />
    )
  }

  return (
    <div
      className="lms-pe-slide-shape"
      style={{
        borderRadius: element.radius || 0,
        background: element.fill,
        border: element.strokeWidth
          ? `${element.strokeWidth}px solid ${element.stroke}`
          : 'none',
      }}
    />
  )
}

export function SlideCanvas({ slide, label = 'Presentation slide', className = '' }) {
  const [ref, scale] = useSlideScale()

  return (
    <div
      ref={ref}
      className={`lms-pe-slide-frame ${className}`}
      aria-label={label}
      role="img"
    >
      <div
        className="lms-pe-slide-surface"
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          background: backgroundCss(slide?.background),
          transform: `scale(${scale})`,
        }}
      >
        {slide?.elements?.map((element) => (
          <div key={element.id} style={slideElementStyle(element)}>
            <SlideElementBody element={element} />
          </div>
        ))}
      </div>
    </div>
  )
}
