import { useCallback, useEffect, useRef, useState } from 'react'

export const MIN_ZOOM = 1
export const MAX_ZOOM = 8
const STEP = 1.25
const DOUBLE_CLICK_ZOOM = 2
/** Pointer movement (px) below which a press counts as a click, not a drag. */
const DRAG_THRESHOLD = 4

interface View {
  scale: number
  x: number
  y: number
}

const FIT: View = { scale: 1, x: 0, y: 0 }

export interface ZoomPan {
  scale: number
  /** Top-left of the zoomed content relative to its box, in px. */
  offset: { x: number; y: number }
  isZoomed: boolean
  /** Inline style for the zoomed element (transform-origin is its top-left corner). */
  style: React.CSSProperties
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  /** True right after a drag, so the caller can ignore the click that ends it. */
  wasDragged: () => boolean
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void
    onDoubleClick: (e: React.MouseEvent<HTMLElement>) => void
  }
}

/** Where the element's untransformed box starts on screen - unlike getBoundingClientRect, unaffected by the zoom itself. */
function boxOrigin(el: HTMLElement): { left: number; top: number } {
  const parent = el.offsetParent?.getBoundingClientRect()
  return { left: (parent?.left ?? 0) + el.offsetLeft, top: (parent?.top ?? 0) + el.offsetTop }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Zoom and pan for one element, applied as a CSS transform over its own
 * fitted box. Zooming keeps the point under the cursor still; panning is
 * limited so the image always covers its box (no dragging it off-screen).
 */
export function useZoomPan(target: React.RefObject<HTMLElement>): ZoomPan {
  const [view, setView] = useState<View>(FIT)
  const drag = useRef<{
    startX: number
    startY: number
    x: number
    y: number
    moved: boolean
  } | null>(null)
  const dragged = useRef(false)

  const constrain = useCallback(
    (next: View): View => {
      const el = target.current
      if (!el || next.scale <= MIN_ZOOM) return FIT
      const width = el.offsetWidth
      const height = el.offsetHeight
      return {
        scale: next.scale,
        x: clamp(next.x, width - width * next.scale, 0),
        y: clamp(next.y, height - height * next.scale, 0)
      }
    },
    [target]
  )

  /** Zoom to `scale`, keeping the point at (`px`, `py`) - relative to the element's box - still. */
  const zoomAt = useCallback(
    (scale: number, px?: number, py?: number) => {
      setView((prev) => {
        const el = target.current
        const nextScale = clamp(scale, MIN_ZOOM, MAX_ZOOM)
        const cx = px ?? (el ? el.offsetWidth / 2 : 0)
        const cy = py ?? (el ? el.offsetHeight / 2 : 0)
        const contentX = (cx - prev.x) / prev.scale
        const contentY = (cy - prev.y) / prev.scale
        return constrain({
          scale: nextScale,
          x: cx - contentX * nextScale,
          y: cy - contentY * nextScale
        })
      })
    },
    [constrain, target]
  )

  // React's onWheel listener is passive, so it can't stop the page from scrolling.
  useEffect(() => {
    const el = target.current
    if (!el) return
    function handleWheel(e: WheelEvent): void {
      e.preventDefault()
      const origin = boxOrigin(el!)
      const px = e.clientX - origin.left
      const py = e.clientY - origin.top
      setView((prev) => {
        const nextScale = clamp(prev.scale * (e.deltaY < 0 ? STEP : 1 / STEP), MIN_ZOOM, MAX_ZOOM)
        const contentX = (px - prev.x) / prev.scale
        const contentY = (py - prev.y) / prev.scale
        return constrain({
          scale: nextScale,
          x: px - contentX * nextScale,
          y: py - contentY * nextScale
        })
      })
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return (): void => el.removeEventListener('wheel', handleWheel)
  }, [constrain, target])

  const pointFromEvent = (e: React.MouseEvent<HTMLElement>): { x: number; y: number } => {
    const origin = boxOrigin(e.currentTarget)
    return { x: e.clientX - origin.left, y: e.clientY - origin.top }
  }

  return {
    scale: view.scale,
    offset: { x: view.x, y: view.y },
    isZoomed: view.scale > MIN_ZOOM,
    style: {
      transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
      transformOrigin: '0 0'
    },
    zoomIn: () => zoomAt(view.scale * STEP),
    zoomOut: () => zoomAt(view.scale / STEP),
    reset: () => setView(FIT),
    wasDragged: () => dragged.current,
    handlers: {
      onPointerDown: (e): void => {
        dragged.current = false
        if (e.button !== 0 || view.scale <= MIN_ZOOM) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { startX: e.clientX, startY: e.clientY, x: view.x, y: view.y, moved: false }
      },
      onPointerMove: (e): void => {
        const current = drag.current
        if (!current) return
        const dx = e.clientX - current.startX
        const dy = e.clientY - current.startY
        if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        current.moved = true
        dragged.current = true
        setView((prev) => constrain({ scale: prev.scale, x: current.x + dx, y: current.y + dy }))
      },
      onPointerUp: (e): void => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
        drag.current = null
      },
      onDoubleClick: (e): void => {
        if (view.scale > MIN_ZOOM) {
          setView(FIT)
          return
        }
        const point = pointFromEvent(e)
        zoomAt(DOUBLE_CLICK_ZOOM, point.x, point.y)
      }
    }
  }
}
