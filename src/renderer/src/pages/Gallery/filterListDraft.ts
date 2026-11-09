import type { TFunction } from 'i18next'
import { typeFilterLabel } from '../../components/FilterBar/typeFilterLabel'
import { normalizeTypes } from '@shared/query/mediaTypes'
import type { FilterListInput, FilterListModel, MediaFilters, SavedFilters } from '@shared/models'
import { groupEntityIds, parseGroupEntry } from '@shared/query/groupEntry'

/** What the save step will store, minus the name. */
export type FilterListDraft = Omit<FilterListInput, 'name'>

export type DraftSection =
  | 'lists'
  | 'search'
  | 'type'
  | 'sfw'
  | 'ai'
  | 'artist'
  | 'tags'
  | 'characters'
  | 'series'

export interface DraftItem {
  key: string
  section: DraftSection
  label: string
  excluded?: boolean
  /** Starts another OR group of its section, so it reads "a or b". */
  startsGroup?: boolean
  /** The draft once this item is taken out. */
  without: FilterListDraft
}

export interface DraftNames {
  lists: Map<string, string>
  artists: Map<string, string>
  tags: Map<string, string>
  characters: Map<string, string>
  series: Map<string, string>
}

type GroupField = 'tagGroups' | 'characterGroups' | 'seriesGroups'
type ExactField = 'exactCharacterIds' | 'exactSeriesIds'

/** Applied lists become includes, and paging and Pending aren't filters to keep. */
export function toDraft(filters: MediaFilters): FilterListDraft {
  const { filterListIds, ...rest } = filters
  const saved: SavedFilters & Partial<MediaFilters> = { ...rest }
  delete saved.limit
  delete saved.offset
  delete saved.pendingTagging
  return { filters: saved, includedListIds: filterListIds ?? [] }
}

function withoutEntry(
  filters: SavedFilters,
  field: GroupField,
  exactField: ExactField | undefined,
  groupIndex: number,
  entryIndex: number
): SavedFilters {
  const groups = (filters[field] ?? [])
    .map((group, g) => (g === groupIndex ? group.filter((_, e) => e !== entryIndex) : group))
    .filter((group) => group.length > 0)
  const next: SavedFilters = { ...filters, [field]: groups.length > 0 ? groups : undefined }
  if (exactField) {
    const remaining = new Set(groupEntityIds(groups))
    const exact = filters[exactField]?.filter((id) => remaining.has(id))
    next[exactField] = exact?.length ? exact : undefined
  }
  return next
}

/** A list and everything it includes, followed all the way down. */
function reachableIds(lists: FilterListModel[], id: string): Set<string> {
  const byId = new Map(lists.map((list) => [list.id, list]))
  const seen = new Set<string>()
  const pending = [id]
  while (pending.length) {
    const next = pending.pop()!
    if (seen.has(next)) continue
    seen.add(next)
    pending.push(...(byId.get(next)?.includedListIds ?? []))
  }
  return seen
}

/** The lists `listId` can include: never itself, or one that would loop back to it. */
export function listsSafeToInclude(
  lists: FilterListModel[],
  listId: string | null
): FilterListModel[] {
  if (listId === null) return lists
  return lists.filter((list) => !reachableIds(lists, list.id).has(listId))
}

/** Whether this list, or one inside it, lost a filter to a deleted entity. */
export function reachesLostFilter(lists: FilterListModel[], listId: string): boolean {
  const reachable = reachableIds(lists, listId)
  return lists.some((list) => reachable.has(list.id) && list.hasMissingEntities)
}

/** One line per thing stored, in the order the dialog shows them. */
export function describeDraft(
  draft: FilterListDraft,
  names: DraftNames,
  t: TFunction
): DraftItem[] {
  const { filters, includedListIds } = draft
  const items: DraftItem[] = includedListIds.map((id) => ({
    key: `list-${id}`,
    section: 'lists',
    label: names.lists.get(id) ?? id,
    without: { ...draft, includedListIds: includedListIds.filter((other) => other !== id) }
  }))

  function scalar(key: keyof SavedFilters, section: DraftSection, label: string): void {
    items.push({
      key,
      section,
      label,
      without: { ...draft, filters: { ...filters, [key]: undefined } }
    })
  }

  function groups(
    section: DraftSection,
    field: GroupField,
    labels: Map<string, string>,
    exactField?: ExactField
  ): void {
    filters[field]?.forEach((group, groupIndex) => {
      group.forEach((entry, entryIndex) => {
        const { id, excluded } = parseGroupEntry(entry)
        const name = labels.get(id) ?? id
        const exact = exactField && filters[exactField]?.includes(id)
        items.push({
          key: `${field}-${groupIndex}-${entry}`,
          section,
          label: exact ? t('filterLists.onlyThisOne', { name }) : name,
          excluded,
          startsGroup: groupIndex > 0 && entryIndex === 0,
          without: {
            ...draft,
            filters: withoutEntry(filters, field, exactField, groupIndex, entryIndex)
          }
        })
      })
    })
  }

  if (filters.query) scalar('query', 'search', filters.query)
  const types = normalizeTypes(filters.type)
  if (types) scalar('type', 'type', typeFilterLabel(types, t))
  if (filters.sfw !== undefined) {
    scalar('sfw', 'sfw', filters.sfw ? t('filters.sfwOnly') : t('filters.nsfwOnly'))
  }
  if (filters.isAiGenerated !== undefined) {
    scalar(
      'isAiGenerated',
      'ai',
      filters.isAiGenerated ? t('filters.aiOnly') : t('filters.aiExcluded')
    )
  }
  if (filters.artistId) {
    scalar('artistId', 'artist', names.artists.get(filters.artistId) ?? filters.artistId)
  }
  if (filters.noArtist) scalar('noArtist', 'artist', t('filters.noArtist'))
  groups('tags', 'tagGroups', names.tags)
  groups('characters', 'characterGroups', names.characters, 'exactCharacterIds')
  if (filters.noCharacter) scalar('noCharacter', 'characters', t('filters.noCharacter'))
  groups('series', 'seriesGroups', names.series, 'exactSeriesIds')
  if (filters.noSeries) scalar('noSeries', 'series', t('filters.noSeries'))
  return items
}

/** A list's contents as one line, for telling lists apart at a glance. */
export function describeList(list: FilterListDraft, names: DraftNames, t: TFunction): string {
  return describeDraft(list, names, t)
    .map((item) => {
      if (item.section === 'lists') return t('filterLists.includes', { name: item.label })
      return item.excluded ? t('filterLists.without', { name: item.label }) : item.label
    })
    .join(' · ')
}
