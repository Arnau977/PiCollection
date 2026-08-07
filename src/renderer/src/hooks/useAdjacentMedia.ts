import { useEffect, useState } from 'react'
import { readGallerySession } from './useGallerySession'
import { FALLBACK_GALLERY_DEFAULTS } from '../utils/gallerySettings'

interface AdjacentMedia {
  previousId: string | null
  nextId: string | null
}

const EMPTY: AdjacentMedia = { previousId: null, nextId: null }

/**
 * Previous/next sibling ids for the media detail page, ordered the same way the
 * gallery the user came from was: reuses `readGallerySession()`'s filters/sorting
 * so paging through a filtered/sorted view "just works", falling back to the
 * default gallery order when there's no session (e.g. a direct link).
 */
export function useAdjacentMedia(id: string | undefined): AdjacentMedia {
  const [state, setState] = useState<AdjacentMedia>(EMPTY)

  useEffect(() => {
    if (!id) {
      setState(EMPTY)
      return
    }

    let cancelled = false
    const session = readGallerySession()
    const filters = session?.filters ?? {}
    const sorting = session?.sorting ?? {
      prop: FALLBACK_GALLERY_DEFAULTS.sortProp,
      desc: FALLBACK_GALLERY_DEFAULTS.sortDesc
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
          nextId: index < result.data.length - 1 ? result.data[index + 1] : null
        })
      })
      .catch(() => {
        if (!cancelled) setState(EMPTY)
      })

    return (): void => {
      cancelled = true
    }
  }, [id])

  return state
}
