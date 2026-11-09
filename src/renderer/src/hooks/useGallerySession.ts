import { useCallback, useState } from 'react'
import type { MediaFilters, Sorting } from '@shared/models'

/** A list open in the gallery's filters, kept here so opening a media doesn't end it. */
export interface ListEdit {
  id: string
  /** As it was when opened: only the "leave without saving" dialog shows it. */
  name: string
  /** The filters to go back to on Cancel. */
  before: MediaFilters
  /** The filters it opened into, to tell whether anything changed. */
  opened: MediaFilters
  /** Gallery defaults left applied that the list itself doesn't set. */
  heldDefaults: Pick<MediaFilters, 'sfw' | 'type'>
}

export interface GallerySession {
  filters: MediaFilters
  sorting: Sorting
  page: number
  listEdit?: ListEdit
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

export interface GalleryReturn {
  mediaId: string
  /** Its position under the gallery's filters and sorting, once known. */
  focusIndex?: number
}

/**
 * The media last viewed, for going back through history (the mouse's back
 * button), which can't carry router state the way "Back to gallery" does.
 */
let galleryReturn: GalleryReturn | null = null

export function readGalleryReturn(): GalleryReturn | null {
  return galleryReturn
}

export function writeGalleryReturn(next: GalleryReturn | null): void {
  galleryReturn = next
}

export interface GalleryOpenedFrom {
  mediaId: string
  /** The card's top, in px from the top of the gallery's scroll region. */
  offsetTop: number
}

/**
 * Where on screen the card stood when it was opened, so coming back to that
 * same media puts the view exactly where it was instead of centering it.
 */
let galleryOpenedFrom: GalleryOpenedFrom | null = null

export function readGalleryOpenedFrom(): GalleryOpenedFrom | null {
  return galleryOpenedFrom
}

export function writeGalleryOpenedFrom(next: GalleryOpenedFrom | null): void {
  galleryOpenedFrom = next
}

/** Test helper: forgets the remembered filters and selection. */
export function resetGallerySession(): void {
  session = null
  selection = new Set()
  galleryReturn = null
  galleryOpenedFrom = null
}

interface UseGallerySessionResult extends GallerySession {
  setFilters: (filters: MediaFilters) => void
  setSorting: (sorting: Sorting) => void
  setPage: (page: number) => void
  /** Starts or ends a list edit, swapping the filters in the same step. */
  setListEdit: (filters: MediaFilters, listEdit: ListEdit | undefined) => void
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
  const setListEdit = useCallback(
    (filters: MediaFilters, listEdit: ListEdit | undefined) =>
      update({ filters, listEdit, page: 0 }),
    [update]
  )

  return { ...state, setFilters, setSorting, setPage, setListEdit }
}
