import { useEffect, useRef, useState } from 'react'

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
 * Only ids not already in the map are requested: the underlying SQL picks a
 * thumbnail with `ORDER BY RANDOM()`, so re-fetching an already-resolved id
 * would hand it a *different* image, visibly re-shuffling every row on every
 * search keystroke pause or sort toggle.
 *
 * Tradeoff: once an id resolves (to an entry or to `null`) it is never
 * re-fetched for the lifetime of the mount, even if the underlying data
 * changes later in the session - consistent with the rest of this app's list
 * caches, which likewise only invalidate on an explicit refetch.
 */
export function useEntityThumbnails(
  kind: EntityThumbnailKind,
  ids: string[]
): Map<string, ThumbnailEntry | null> {
  const [entries, setEntries] = useState<Map<string, ThumbnailEntry | null>>(new Map())
  // Read inside the effect without being a dependency: the effect must see the
  // latest resolved set to know what to skip, but must not re-run because of it.
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  useEffect(() => {
    let cancelled = false
    const missingIds = ids.filter((id) => !entriesRef.current.has(id))
    if (missingIds.length === 0) return

    /** Every requested id gets an entry, so a failure resolves rows to the placeholder instead of shimmering forever. */
    const resolveAllMissingAsEmpty = (): void => {
      setEntries((prev) => {
        const next = new Map(prev)
        for (const id of missingIds) {
          if (!next.has(id)) next.set(id, null)
        }
        return next
      })
    }

    window.api.media
      .getEntityThumbnails(kind, missingIds)
      .then((result) => {
        if (cancelled) return
        if (!result.success) {
          resolveAllMissingAsEmpty()
          return
        }
        const found = new Map(
          result.data.map((row) => [row.entityId, { route: row.route, type: row.type }])
        )
        setEntries((prev) => {
          const next = new Map(prev)
          for (const id of missingIds) {
            next.set(id, found.get(id) ?? null)
          }
          return next
        })
      })
      .catch(() => {
        if (cancelled) return
        resolveAllMissingAsEmpty()
      })

    return (): void => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ids` is compared by content, not identity (see call sites' useMemo); `entriesRef` is read intentionally outside the deps
  }, [kind, ids.join(',')])

  return entries
}
