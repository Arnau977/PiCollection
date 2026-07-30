import type { MediaFilters } from '@shared/models'

function hasNonEmptyGroup(groups: string[][] | undefined): boolean {
  return Boolean(groups?.some((group) => group.length > 0))
}

export function hasActiveFilters(filters: MediaFilters): boolean {
  return Boolean(
    filters.query?.trim() ||
      filters.artistId ||
      filters.sfw !== undefined ||
      filters.type ||
      hasNonEmptyGroup(filters.tagGroups) ||
      hasNonEmptyGroup(filters.characterGroups) ||
      filters.seriesIds?.length
  )
}
