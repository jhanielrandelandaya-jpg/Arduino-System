import { useLayoutEffect, useRef, useState } from 'react'
import { SLIDE_WIDTH } from './presentationData.js'

export function useSlideScale() {
  const ref = useRef(null)
  const [scale, setScale] = useState(0.25)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined

    const update = () => {
      const width = element.getBoundingClientRect().width
      if (width > 0) setScale(width / SLIDE_WIDTH)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, scale]
}

export const slideElementStyle = (element) => ({
  position: 'absolute',
  left: element.x,
  top: element.y,
  width: element.w,
  height: element.h,
  opacity: element.opacity ?? 1,
  transform: `rotate(${element.rotation || 0}deg)`,
  transformOrigin: 'center',
})
