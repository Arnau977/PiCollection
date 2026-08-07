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
 * returned map. A map entry of `null` means "asked, no eligible thumbnail
 * found" (distinct from "not yet asked", i.e. absent from the map) so
 * callers can tell "still loading" apart from "confirmed no thumbnail".
 * Merges each fetch's results into the existing map rather than replacing
 * it, so a row already resolved from an earlier fetch doesn't flicker back
 * to a loading state when the visible id list changes (e.g. on scroll).
 * Re-fetches whenever the id list changes (a Manage page's `ids` should be
 * memoized by its caller so this doesn't refire on every unrelated render).
 */
export function useEntityThumbnails(
  kind: EntityThumbnailKind,
  ids: string[]
): Map<string, ThumbnailEntry | null> {
  const [entries, setEntries] = useState<Map<string, ThumbnailEntry | null>>(new Map())

  useEffect(() => {
    let cancelled = false
    if (ids.length === 0) return

    window.api.media.getEntityThumbnails(kind, ids).then((result) => {
      if (cancelled || !result.success) return
      const found = new Map(
        result.data.map((row) => [row.entityId, { route: row.route, type: row.type }])
      )
      setEntries((prev) => {
        const next = new Map(prev)
        for (const id of ids) {
          next.set(id, found.get(id) ?? null)
        }
        return next
      })
    })

    return (): void => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ids` is compared by content, not identity; see call sites' useMemo
  }, [kind, ids.join(',')])

  return entries
}
