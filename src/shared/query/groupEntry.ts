/**
 * A tag/character/series filter group (`MediaFilters.tagGroups` etc.) holds
 * entity ids, AND'd together. An entry prefixed with `-` is an exclusion:
 * `['mythra', '-pyra']` means "has Mythra and doesn't have Pyra". Entity ids
 * are UUIDs, so the prefix can't clash with a real id.
 */
const EXCLUDE_PREFIX = '-'

export interface GroupEntry {
  id: string
  excluded: boolean
}

export function parseGroupEntry(entry: string): GroupEntry {
  return entry.startsWith(EXCLUDE_PREFIX)
    ? { id: entry.slice(EXCLUDE_PREFIX.length), excluded: true }
    : { id: entry, excluded: false }
}

export function toGroupEntry({ id, excluded }: GroupEntry): string {
  return excluded ? `${EXCLUDE_PREFIX}${id}` : id
}

/** Every entity id the groups mention, included or excluded. */
export function groupEntityIds(groups: string[][] | undefined): string[] {
  return (groups ?? []).flat().map((entry) => parseGroupEntry(entry).id)
}
