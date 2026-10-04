import type { MediaFilters } from '@shared/models'
import { parseGroupEntry } from '@shared/query/groupEntry'

export interface KnownEntityIds {
  artists: Set<string>
  tags: Set<string>
  characters: Set<string>
  series: Set<string>
}

function pruneGroups(groups: string[][] | undefined, known: Set<string>): string[][] | undefined {
  if (!groups) return groups
  const kept = groups
    .map((group) => group.filter((entry) => known.has(parseGroupEntry(entry).id)))
    .filter((group) => group.length > 0)
  return kept.length > 0 ? kept : undefined
}

function pruneIds(ids: string[] | undefined, known: Set<string>): string[] | undefined {
  if (!ids) return ids
  const kept = ids.filter((id) => known.has(id))
  return kept.length > 0 ? kept : undefined
}

/**
 * Drops filter ids whose entity no longer exists (deleted or merged since the
 * filter was set). Its chip can't be drawn - there's no name to show - but
 * the filter would still apply, leaving an invisible filter that empties the
 * gallery. Returns `filters` itself when nothing had to go.
 */
export function pruneMissingEntities(filters: MediaFilters, known: KnownEntityIds): MediaFilters {
  const pruned: MediaFilters = {
    ...filters,
    artistId:
      filters.artistId && known.artists.has(filters.artistId) ? filters.artistId : undefined,
    tagGroups: pruneGroups(filters.tagGroups, known.tags),
    characterGroups: pruneGroups(filters.characterGroups, known.characters),
    exactCharacterIds: pruneIds(filters.exactCharacterIds, known.characters),
    seriesGroups: pruneGroups(filters.seriesGroups, known.series),
    exactSeriesIds: pruneIds(filters.exactSeriesIds, known.series)
  }
  const keys = [
    'artistId',
    'tagGroups',
    'characterGroups',
    'exactCharacterIds',
    'seriesGroups',
    'exactSeriesIds'
  ] as const
  const changed = keys.some((key) => JSON.stringify(pruned[key]) !== JSON.stringify(filters[key]))
  return changed ? pruned : filters
}
