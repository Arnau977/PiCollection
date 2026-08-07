import { useEffect, useState } from 'react'

export type EntityThumbnailKind = 'artist' | 'tag' | 'character' | 'series'

interface ThumbnailEntry {
  route: string
  // Matches the preload's `getEntityThumbnails` return shape, which declares this as a
  // plain string rather than a narrowed media-type union.
  type: string
}

/**
 * One IPC round trip for every visible row's thumbnail, instead of one
 * unbounded `media.getFiltered` per row - a Manage page calls this once with
 * every currently-visible id and looks each row's thumbnail up in the
 * returned map. Re-fetches whenever the id list changes (a Manage page's
 * `ids` should be memoized by its caller so this doesn't refire on every
 * unrelated render).
 */
export function useEntityThumbnails(
  kind: EntityThumbnailKind,
  ids: string[]
): Map<string, ThumbnailEntry> {
  const [entries, setEntries] = useState<Map<string, ThumbnailEntry>>(new Map())

  useEffect(() => {
    let cancelled = false
    if (ids.length === 0) {
      setEntries(new Map())
      return
    }

    window.api.media.getEntityThumbnails(kind, ids).then((result) => {
      if (cancelled || !result.success) return
      setEntries(
        new Map(result.data.map((row) => [row.entityId, { route: row.route, type: row.type }]))
      )
    })

    return (): void => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ids` is compared by content, not identity; see call sites' useMemo
  }, [kind, ids.join(',')])

  return entries
}
