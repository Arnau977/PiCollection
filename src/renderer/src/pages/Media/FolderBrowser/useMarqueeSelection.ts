import { useEffect, useRef, useState, type RefObject } from 'react'

/** Movement (px) before a press becomes a drag instead of a click. */
const DRAG_THRESHOLD = 6
/** Distance (px) from the scroll region's top/bottom edge that scrolls it while dragging. */
const AUTO_SCROLL_EDGE = 40
const AUTO_SCROLL_MAX_STEP = 18
/** A press on any of these is theirs (a tile, a button, a checkbox...), never a drag start. */
const INTERACTIVE = 'button, a, input, label, select, textarea, [role="button"], [aria-modal="true"]'

/** Attribute that marks a tile the rectangle can pick; its value is the tile's key. */
export const MARQUEE_KEY_ATTR = 'data-marquee-key'

export interface MarqueeRect {
  left: number
  top: number
  width: number
  height: number
}

/** As in Windows Explorer: a plain drag replaces the selection, Ctrl+drag flips what it covers. */
export type MarqueeMode = 'replace' | 'toggle'

interface Drag {
  startX: number
  startY: number
  pressX: number
  pressY: number
  clientX: number
  clientY: number
  active: boolean
  mode: MarqueeMode
}

interface UseMarqueeSelectionArgs {
  /** The scroll region the tiles live in; the rectangle is drawn in its content. */
  containerRef: RefObject<HTMLElement>
  /**
   * Where a drag may start: anywhere inside the closest ancestor matching
   * this (e.g. the page's side margins), level with the scroll region.
   */
  surfaceSelector: string
  onCommit: (keys: string[], mode: MarqueeMode) => void
  /** A press on empty space released without dragging (Ctrl held or not). */
  onEmptyClick: (ctrl: boolean) => void
}

export interface MarqueeSelection {
  /** Where to draw the rectangle, in viewport coordinates (a fixed overlay). */
  rect: MarqueeRect | null
  /** Keys under the rectangle right now, and how releasing will apply them. */
  preview: { keys: Set<string>; mode: MarqueeMode } | null
}

/**
 * Rubber-band selection over a grid of tiles, as in Windows Explorer: press
 * on empty space - a gap between tiles, below them, or the page margins
 * beside the grid - and drag to draw a rectangle; the tiles it touches are
 * picked on release. Scrolls the region near its edges and Esc cancels.
 */
export function useMarqueeSelection({
  containerRef,
  surfaceSelector,
  onCommit,
  onEmptyClick
}: UseMarqueeSelectionArgs): MarqueeSelection {
  const [rect, setRect] = useState<MarqueeRect | null>(null)
  const [preview, setPreview] = useState<MarqueeSelection['preview']>(null)
  const callbacksRef = useRef({ onCommit, onEmptyClick })
  callbacksRef.current = { onCommit, onEmptyClick }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let drag: Drag | null = null
    let frame = 0

    const update = (): void => {
      if (!drag?.active) return
      const next = rectBetween(drag, toContent(container, drag.clientX, drag.clientY))
      setRect(onScreen(container, next))
      setPreview({ keys: keysInside(container, next), mode: drag.mode })
    }
    const autoScroll = (): void => {
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
    const stop = (): void => {
      cancelAnimationFrame(frame)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('keydown', handleKey, true)
      drag = null
      setRect(null)
      setPreview(null)
    }
    const handleMove = (event: MouseEvent): void => {
      if (!drag) return
      drag.clientX = event.clientX
      drag.clientY = event.clientY
      if (!drag.active) {
        const moved = Math.hypot(event.clientX - drag.pressX, event.clientY - drag.pressY)
        if (moved < DRAG_THRESHOLD) return
        drag.active = true
        frame = requestAnimationFrame(autoScroll)
      }
      update()
    }
    const handleUp = (event: MouseEvent): void => {
      if (!drag) return
      if (drag.active) {
        const area = rectBetween(drag, toContent(container, drag.clientX, drag.clientY))
        callbacksRef.current.onCommit([...keysInside(container, area)], drag.mode)
      } else {
        callbacksRef.current.onEmptyClick(event.ctrlKey || event.metaKey)
      }
      stop()
    }
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !drag?.active) return
      // Stops the "clear selection" Esc shortcut from also running.
      event.stopImmediatePropagation()
      stop()
    }
    const handleDown = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null
      if (event.button !== 0 || event.shiftKey || !target) return
      if (!target.closest(surfaceSelector) || target.closest(INTERACTIVE)) return
      if (document.querySelector('[aria-modal="true"]')) return
      // Only the band level with the grid: not the header or the actions row.
      const bounds = container.getBoundingClientRect()
      if (event.clientY < bounds.top || event.clientY > bounds.bottom) return
      if (event.clientX >= bounds.right - scrollbarWidth(container) && event.clientX <= bounds.right)
        return
      event.preventDefault()
      const start = toContent(container, event.clientX, event.clientY)
      drag = {
        startX: start.x,
        startY: start.y,
        pressX: event.clientX,
        pressY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        active: false,
        mode: event.ctrlKey || event.metaKey ? 'toggle' : 'replace'
      }
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
      window.addEventListener('keydown', handleKey, true)
    }

    document.addEventListener('mousedown', handleDown)
    return (): void => {
      document.removeEventListener('mousedown', handleDown)
      if (drag) stop()
    }
  }, [containerRef, surfaceSelector])

  return { rect, preview }
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

function rectBetween(drag: Drag, end: { x: number; y: number }): MarqueeRect {
  return {
    left: Math.min(drag.startX, end.x),
    top: Math.min(drag.startY, end.y),
    width: Math.abs(end.x - drag.startX),
    height: Math.abs(end.y - drag.startY)
  }
}

/**
 * The rectangle in viewport coordinates, for a fixed overlay: it spans the
 * page margins it was started in, but is cut to the region's height so it
 * never covers the header or the actions row while the content scrolls.
 */
function onScreen(container: HTMLElement, rect: MarqueeRect): MarqueeRect {
  const bounds = container.getBoundingClientRect()
  const left = rect.left + bounds.left - container.scrollLeft
  const top = Math.max(bounds.top, rect.top + bounds.top - container.scrollTop)
  const bottom = Math.min(bounds.bottom, rect.top + rect.height + bounds.top - container.scrollTop)
  return { left, top, width: rect.width, height: Math.max(0, bottom - top) }
}

/** Pressing the region's own scrollbar must scroll it, not start a rectangle. */
function scrollbarWidth(container: HTMLElement): number {
  return container.offsetWidth - container.clientWidth
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
