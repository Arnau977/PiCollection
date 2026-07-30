import { useEffect, useState } from 'react'
import type { MediaModel } from '@shared/models'

export type EntityThumbnailKind = 'artist' | 'tag' | 'character' | 'series'

interface EntityThumbnailState {
  route: string | null
  type: MediaModel['type'] | null
  loading: boolean
}

const INITIAL_STATE: EntityThumbnailState = { route: null, type: null, loading: true }

/**
 * NSFW media is never eligible for this preview: at the small, cropped size
 * these listings render at, a blurred-and-zoomed NSFW thumbnail reads as a
 * meaningless smudge rather than a useful preview. An entity with only NSFW
 * media falls back to the placeholder icon instead.
 */
export function useEntityThumbnail(kind: EntityThumbnailKind, id: string): EntityThumbnailState {
  const [state, setState] = useState<EntityThumbnailState>(INITIAL_STATE)

  useEffect(() => {
    let cancelled = false
    setState(INITIAL_STATE)

    const filters =
      kind === 'artist'
        ? { artistId: id, sfw: true }
        : kind === 'tag'
          ? { tagGroups: [[id]], sfw: true }
          : kind === 'character'
            ? { characterGroups: [[id]], sfw: true }
            : { seriesIds: [id], sfw: true }

    window.api.media.getFiltered(filters).then((result) => {
      if (cancelled) return
      if (!result.success || result.data.items.length === 0) {
        setState({ route: null, type: null, loading: false })
        return
      }
      const items = result.data.items
      const pick = items[Math.floor(Math.random() * items.length)]
      setState({ route: pick.route, type: pick.type, loading: false })
    })

    return (): void => {
      cancelled = true
    }
  }, [kind, id])

  return state
}
