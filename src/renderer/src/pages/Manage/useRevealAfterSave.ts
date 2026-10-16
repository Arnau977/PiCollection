import { useCallback, useEffect, useRef } from 'react'

/**
 * Keeps a just-saved Metadata entry in view: a rename can move it in the
 * sorted list (and a new one lands wherever it sorts), so once the refetched
 * list renders, it is scrolled into view - only if it isn't already visible
 * (`block: 'nearest'`), so an in-place edit leaves the scroll alone. Items
 * carry `data-entity-id` inside the element `listRef` points at.
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
    item?.scrollIntoView?.({ block: 'nearest' })
  }, [data])

  const reveal = useCallback((id: string) => {
    pendingId.current = id
  }, [])

  return { listRef, reveal }
}
