import { useEffect, useRef } from 'react'
import type { MediaFilters } from '@shared/models'
import { useFilterLists } from '../../hooks/useEntityLists'

/**
 * Keeps the gallery honest about the lists applied to it: one deleted since
 * has no chip to show, so it's dropped once the lists loaded cleanly, and an
 * edit reloads the page, since lists resolve in the main process and the
 * filters themselves didn't change.
 */
export function useAppliedFilterLists(
  filters: MediaFilters,
  setFilters: (filters: MediaFilters) => void,
  reload: () => void
): void {
  const { data, loading, error } = useFilterLists()
  const applied = filters.filterListIds

  useEffect(() => {
    if (loading || error || !applied?.length) return
    const known = new Set(data.map((list) => list.id))
    const kept = applied.filter((id) => known.has(id))
    if (kept.length === applied.length) return
    setFilters({ ...filters, filterListIds: kept.length > 0 ? kept : undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setFilters is stable
  }, [loading, error, data, filters])

  // Every list counts: an applied one may include the list that was edited.
  const version = data.map((list) => `${list.id}:${list.updatedAt}`).join()
  const versionRef = useRef(version)
  useEffect(() => {
    const previous = versionRef.current
    versionRef.current = version
    if (previous && previous !== version && applied?.length) reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new version reloads
  }, [version])
}
