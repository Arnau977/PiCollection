import { useEffect, useState } from 'react'
import { readGallerySession } from './useGallerySession'
import { loadGalleryDefaults } from '../utils/gallerySettings'
import type { MediaFilters, Sorting } from '@shared/models'

interface AdjacentMedia {
  previousId: string | null
  nextId: string | null
  /** 0-based position of `id` within the ordered list, or null while loading/unresolved. */
  index: number | null
  /** Size of the ordered list, or null while loading/unresolved. */
  total: number | null
}

interface AdjacentMediaOverride {
  filters: MediaFilters
  sorting: Sorting
}

const EMPTY: AdjacentMedia = { previousId: null, nextId: null, index: null, total: null }

/**
 * Previous/next sibling ids for the media detail page. By default, reuses
 * `readGallerySession()`'s filters/sorting so paging through a filtered/sorted
 * gallery view "just works", falling back to the default gallery order when
 * there's no session (e.g. a direct link). Passing `override` bypasses the
 * gallery session entirely - used by the Pending flow, which must never read
 * or write the shared gallery session (that would corrupt the user's
 * remembered Gallery filters the next time they visit the gallery).
 */
export function useAdjacentMedia(
  id: string | undefined,
  override?: AdjacentMediaOverride
): AdjacentMedia {
  const [state, setState] = useState<AdjacentMedia>(EMPTY)

  useEffect(() => {
    if (!id) {
      setState(EMPTY)
      return
    }

    let cancelled = false
    let filters: MediaFilters
    let sorting: Sorting
    if (override) {
      filters = override.filters
      sorting = override.sorting
    } else {
      // The list the gallery itself would show: its remembered filters, or
      // with none yet (no visit since the app started, e.g. arriving from
      // Storage) the same defaults it opens with - and never Pending, which
      // the gallery always leaves out. Anything else gives positions the
      // gallery then can't find (a page past its last).
      const session = readGallerySession()
      const defaults = loadGalleryDefaults()
      filters = {
        ...(session?.filters ?? { sfw: defaults.sfw, type: defaults.type }),
        pendingTagging: false
      }
      sorting = session?.sorting ?? { prop: defaults.sortProp, desc: defaults.sortDesc }
    }

    window.api.media
      .getOrderedIds(filters, sorting)
      .then((result) => {
        if (cancelled) return
        if (!result.success) {
          setState(EMPTY)
          return
        }
        const index = result.data.indexOf(id)
        if (index === -1) {
          setState(EMPTY)
          return
        }
        setState({
          previousId: index > 0 ? result.data[index - 1] : null,
          nextId: index < result.data.length - 1 ? result.data[index + 1] : null,
          index,
          total: result.data.length
        })
      })
      .catch(() => {
        if (!cancelled) setState(EMPTY)
      })

    return (): void => {
      cancelled = true
    }
    // `override` is a plain object literal from the caller and would otherwise
    // retrigger the effect every render; its consumer (MediaPage) only ever
    // changes it together with `id`, so `id` alone is a sufficient dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return state
}
