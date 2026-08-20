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

/** Test helper: forgets the remembered filters. */
export function resetGallerySession(): void {
  session = null
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
