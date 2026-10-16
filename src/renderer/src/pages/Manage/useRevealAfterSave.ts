import { useCallback, useEffect, useRef } from 'react'

const REVEAL_CLASS = 'manage-reveal-highlight'
/** Matches the animation length in ManagePage.css. */
const REVEAL_MS = 1700

/**
 * Keeps a just-saved Metadata entry in view: a rename can move it in the
 * sorted list (and a new one lands wherever it sorts), so once the refetched
 * list renders, it is scrolled into view - only if it isn't already visible
 * (`block: 'nearest'`), so an in-place edit leaves the scroll alone - and
 * briefly highlighted, as the gallery does with the card you come back to.
 * Items carry `data-entity-id` inside the element `listRef` points at.
 */
export function useRevealAfterSave(data: unknown[]): {
  listRef: React.RefObject<HTMLDivElement>
  reveal: (id: string) => void
} {
  const listRef = useRef<HTMLDivElement>(null)
  const pendingId = useRef<string | null>(null)

  useEffect(() => {
    const id = pendingId.current
    if (!id) return
    pendingId.current = null
    const item = listRef.current?.querySelector(`[data-entity-id="${id}"]`)
    if (!item) return
    item.scrollIntoView?.({ block: 'nearest' })
    // Set on the node, not through React state, so it needs no change in each
    // manager's className logic; a timer (not animationend) also clears the
    // static reduced-motion version.
    item.classList.add(REVEAL_CLASS)
    setTimeout(() => item.classList.remove(REVEAL_CLASS), REVEAL_MS)
  }, [data])

  const reveal = useCallback((id: string) => {
    pendingId.current = id
  }, [])

  return { listRef, reveal }
}
