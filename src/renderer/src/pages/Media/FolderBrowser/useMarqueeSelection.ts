import { useEffect, useRef, useState, type RefObject } from 'react'

/** Movement (px) before a press on a tile becomes a drag instead of a click. */
const DRAG_THRESHOLD = 6
/** Distance (px) from the scroll region's top/bottom edge that scrolls it while dragging. */
const AUTO_SCROLL_EDGE = 40
const AUTO_SCROLL_MAX_STEP = 18

/** Attribute that marks a tile the rectangle can pick; its value is the tile's key. */
export const MARQUEE_KEY_ATTR = 'data-marquee-key'

export interface MarqueeRect {
  left: number
  top: number
  width: number
  height: number
}

export type MarqueeMode = 'select' | 'deselect'

interface Drag {
  startX: number
  startY: number
  clientX: number
  clientY: number
  active: boolean
  mode: MarqueeMode
}

interface UseMarqueeSelectionArgs {
  /** The scroll region the tiles live in; the rectangle is drawn in its content. */
  containerRef: RefObject<HTMLElement>
  isSelected: (key: string) => boolean
  onCommit: (keys: string[], mode: MarqueeMode) => void
}

export interface MarqueeSelection {
  rect: MarqueeRect | null
  /** Keys under the rectangle right now, and what releasing will do to them. */
  preview: { keys: Set<string>; mode: MarqueeMode } | null
  onMouseDown: (e: React.MouseEvent<HTMLElement>) => void
}

/**
 * Rubber-band selection over a grid of tiles, as in a file manager: press
 * and drag (from a gap or from a tile) to draw a rectangle, and every tile
 * it touches is picked on release. A drag that starts on a selected tile
 * deselects instead. Scrolls the region near its edges, Esc cancels, and
 * the click that ends a drag is swallowed so it doesn't also toggle a tile.
 */
export function useMarqueeSelection({
  containerRef,
  isSelected,
  onCommit
}: UseMarqueeSelectionArgs): MarqueeSelection {
  const [rect, setRect] = useState<MarqueeRect | null>(null)
  const [preview, setPreview] = useState<MarqueeSelection['preview']>(null)
  const dragRef = useRef<Drag | null>(null)
  const cleanupRef = useRef<() => void>()
  const suppressClickRef = useRef(false)
  const isSelectedRef = useRef(isSelected)
  isSelectedRef.current = isSelected
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit

  useEffect(() => (): void => cleanupRef.current?.(), [])

  // Capture phase, so it beats the tiles' own click handlers.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    function swallowClick(e: MouseEvent): void {
      if (!suppressClickRef.current) return
      suppressClickRef.current = false
      e.stopPropagation()
      e.preventDefault()
    }
    container.addEventListener('click', swallowClick, true)
    return (): void => container.removeEventListener('click', swallowClick, true)
  }, [containerRef])

  function onMouseDown(e: React.MouseEvent<HTMLElement>): void {
    const container = containerRef.current
    if (e.button !== 0 || e.shiftKey || !container) return
    suppressClickRef.current = false
    const startKey = (e.target as HTMLElement)
      .closest(`[${MARQUEE_KEY_ATTR}]`)
      ?.getAttribute(MARQUEE_KEY_ATTR)
    const start = toContent(container, e.clientX, e.clientY)
    dragRef.current = {
      startX: start.x,
      startY: start.y,
      clientX: e.clientX,
      clientY: e.clientY,
      active: false,
      mode: startKey && isSelectedRef.current(startKey) ? 'deselect' : 'select'
    }

    let frame = 0
    const update = (): void => {
      const drag = dragRef.current
      if (!drag?.active) return
      const end = toContent(container, drag.clientX, drag.clientY)
      const next = {
        left: Math.min(drag.startX, end.x),
        top: Math.min(drag.startY, end.y),
        width: Math.abs(end.x - drag.startX),
        height: Math.abs(end.y - drag.startY)
      }
      setRect(next)
      setPreview({ keys: keysInside(container, next), mode: drag.mode })
    }
    const autoScroll = (): void => {
      const drag = dragRef.current
      if (!drag?.active) return
      const bounds = container.getBoundingClientRect()
      const step =
        drag.clientY < bounds.top + AUTO_SCROLL_EDGE
          ? -edgeSpeed(bounds.top + AUTO_SCROLL_EDGE - drag.clientY)
          : drag.clientY > bounds.bottom - AUTO_SCROLL_EDGE
            ? edgeSpeed(drag.clientY - (bounds.bottom - AUTO_SCROLL_EDGE))
            : 0
      if (step !== 0) {
        container.scrollTop += step
        update()
      }
      frame = requestAnimationFrame(autoScroll)
    }

    const handleMove = (event: MouseEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      drag.clientX = event.clientX
      drag.clientY = event.clientY
      if (!drag.active) {
        const moved = Math.hypot(event.clientX - e.clientX, event.clientY - e.clientY)
        if (moved < DRAG_THRESHOLD) return
        drag.active = true
        frame = requestAnimationFrame(autoScroll)
      }
      update()
    }
    const finish = (commit: boolean): void => {
      const drag = dragRef.current
      if (drag?.active) {
        suppressClickRef.current = true
        if (commit) {
          const end = toContent(container, drag.clientX, drag.clientY)
          const keys = keysInside(container, {
            left: Math.min(drag.startX, end.x),
            top: Math.min(drag.startY, end.y),
            width: Math.abs(end.x - drag.startX),
            height: Math.abs(end.y - drag.startY)
          })
          if (keys.size > 0) onCommitRef.current([...keys], drag.mode)
        }
      }
      cleanupRef.current?.()
    }
    const handleUp = (): void => finish(true)
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !dragRef.current?.active) return
      // Stops the "clear selection" Esc shortcut from also running.
      event.stopImmediatePropagation()
      finish(false)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('keydown', handleKey, true)
    cleanupRef.current = (): void => {
      cancelAnimationFrame(frame)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('keydown', handleKey, true)
      dragRef.current = null
      cleanupRef.current = undefined
      setRect(null)
      setPreview(null)
    }
  }

  return { rect, preview, onMouseDown }
}

function toContent(
  container: HTMLElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const bounds = container.getBoundingClientRect()
  return {
    x: clientX - bounds.left + container.scrollLeft,
    y: clientY - bounds.top + container.scrollTop
  }
}

function edgeSpeed(depth: number): number {
  return Math.ceil(Math.min(1, depth / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_STEP)
}

function keysInside(container: HTMLElement, rect: MarqueeRect): Set<string> {
  const keys = new Set<string>()
  for (const element of container.querySelectorAll<HTMLElement>(`[${MARQUEE_KEY_ATTR}]`)) {
    const box = element.getBoundingClientRect()
    const topLeft = toContent(container, box.left, box.top)
    const overlaps =
      topLeft.x < rect.left + rect.width &&
      topLeft.x + box.width > rect.left &&
      topLeft.y < rect.top + rect.height &&
      topLeft.y + box.height > rect.top
    const key = element.getAttribute(MARQUEE_KEY_ATTR)
    if (overlaps && key) keys.add(key)
  }
  return keys
}
