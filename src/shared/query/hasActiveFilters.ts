import type { MediaFilters } from '@shared/models'
import { normalizeTypes } from './mediaTypes'

function hasNonEmptyGroup(groups: string[][] | undefined): boolean {
  return Boolean(groups?.some((group) => group.length > 0))
}

export function hasActiveFilters(filters: MediaFilters): boolean {
  return Boolean(
    filters.query?.trim() ||
      filters.artistId ||
      filters.sfw !== undefined ||
      filters.isAiGenerated !== undefined ||
      normalizeTypes(filters.type) ||
      hasNonEmptyGroup(filters.tagGroups) ||
      hasNonEmptyGroup(filters.characterGroups) ||
      filters.noCharacter ||
      hasNonEmptyGroup(filters.seriesGroups) ||
      filters.noSeries ||
      filters.noArtist ||
      filters.filterListIds?.length
  )
}
