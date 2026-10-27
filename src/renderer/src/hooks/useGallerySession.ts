import { useCallback, useState } from 'react'
import type { MediaFilters, Sorting } from '@shared/models'

export interface GallerySession {
  filters: MediaFilters
  sorting: Sorting
  page: number
}

/**
 * Gallery filters live in module scope rather than component state so they
 * survive navigating away from the gallery and back. The module is torn down
 * with the renderer, so everything resets when the app closes - which is
 * exactly the intended lifetime.
 */
let session: GallerySession | null = null

export function readGallerySession(): GallerySession | null {
  return session
}

export function writeGallerySession(next: GallerySession): void {
  session = next
}

/**
 * The gallery's selection, kept the same way: opening a media to check it
 * (instead of ticking it) and coming back mustn't lose what was selected.
 */
let selection: ReadonlySet<string> = new Set()

export function readGallerySelection(): ReadonlySet<string> {
  return selection
}

export function writeGallerySelection(next: ReadonlySet<string>): void {
  selection = next
}

/** A media deleted elsewhere (its detail page) leaves the selection too. */
export function forgetGallerySelection(id: string): void {
  if (!selection.has(id)) return
  const next = new Set(selection)
  next.delete(id)
  selection = next
}

/** Test helper: forgets the remembered filters and selection. */
export function resetGallerySession(): void {
  session = null
  selection = new Set()
}

interface UseGallerySessionResult extends GallerySession {
  setFilters: (filters: MediaFilters) => void
  setSorting: (sorting: Sorting) => void
  setPage: (page: number) => void
}

export function useGallerySession(createInitial: () => GallerySession): UseGallerySessionResult {
  const [state, setState] = useState<GallerySession>(() => {
    // Written through to the shared session immediately, not just on the
    // first explicit setFilters/setSorting/setPage call - otherwise a
    // page-load-only default filter (e.g. gallery defaults' "SFW only") is
    // active in this component's own state and correctly narrows the
    // gallery grid, but readGallerySession() (used by useAdjacentMedia for
    // the detail view's prev/next arrows) still sees null and falls back to
    // no filter at all until the user happens to touch a filter control.
    if (session) return session
    session = createInitial()
    return session
  })

  const update = useCallback((changes: Partial<GallerySession>) => {
    setState((prev) => {
      const next = { ...prev, ...changes }
      session = next
      return next
    })
  }, [])

  const setFilters = useCallback(
    // Changing the filters invalidates the current page offset.
    (filters: MediaFilters) => update({ filters, page: 0 }),
    [update]
  )
  const setSorting = useCallback((sorting: Sorting) => update({ sorting }), [update])
  const setPage = useCallback((page: number) => update({ page }), [update])

  return { ...state, setFilters, setSorting, setPage }
}
