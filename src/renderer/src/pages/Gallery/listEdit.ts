import type { FilterListModel, MediaFilters, SavedFilters } from '@shared/models'
import { parseGroupEntry } from '@shared/query/groupEntry'
import { mergeFilters } from '@shared/query/mergeFilters'
import type { ListEdit } from '../../hooks/useGallerySession'
import type { GalleryDefaults } from '../../utils/gallerySettings'
import { toDraft, type FilterListDraft } from './filterListDraft'

type DefaultKey = keyof ListEdit['heldDefaults']

const DEFAULT_KEYS = ['sfw', 'type'] as const

/**
 * Opens `list` into the gallery's loose filters. What was added beside it
 * joins in, since that's usually why it's being edited. A gallery default the
 * list doesn't set stays applied, so a "safe by default" gallery stays safe,
 * but it's held back from the save: it's the gallery's, not the list's.
 */
export function beginListEdit(
  list: FilterListModel,
  filters: MediaFilters,
  defaults: Pick<GalleryDefaults, DefaultKey>
): { filters: MediaFilters; listEdit: ListEdit } {
  const { filterListIds: _applied, ...loose } = filters
  const heldDefaults: ListEdit['heldDefaults'] = {}
  for (const key of DEFAULT_KEYS) {
    if (loose[key] === undefined || loose[key] !== defaults[key]) continue
    if (list.filters[key] === undefined) Object.assign(heldDefaults, { [key]: loose[key] })
    delete loose[key]
  }

  const opened = mergeFilters(loose, list.filters) ?? list.filters
  return {
    filters: {
      ...opened,
      ...heldDefaults,
      filterListIds: list.includedListIds.length > 0 ? list.includedListIds : undefined
    },
    listEdit: { id: list.id, before: filters, heldDefaults }
  }
}

/** The held-back defaults still applied: changing one makes it the user's choice. */
export function activeHeldDefaults(filters: MediaFilters, listEdit: ListEdit): SavedFilters {
  const held: SavedFilters = {}
  for (const key of DEFAULT_KEYS) {
    const value = listEdit.heldDefaults[key]
    if (value !== undefined && filters[key] === value) Object.assign(held, { [key]: value })
  }
  return held
}

/** What the edit stores: the gallery's filters, minus the defaults held back. */
export function listEditDraft(filters: MediaFilters, listEdit: ListEdit): FilterListDraft {
  const draft = toDraft(filters)
  for (const key of Object.keys(activeHeldDefaults(filters, listEdit))) {
    delete draft.filters[key as DefaultKey]
  }
  return draft
}

/** Saved, the edit closes back into the list's chip, beside what it set aside. */
export function filtersAfterListEdit(listEdit: ListEdit): MediaFilters {
  return { ...listEdit.heldDefaults, filterListIds: listEdit.before.filterListIds }
}

const SINGLE_VALUE_KEYS = [
  'query',
  'type',
  'sfw',
  'isAiGenerated',
  'artistId',
  'noArtist',
  'noCharacter',
  'noSeries'
] as const satisfies (keyof SavedFilters)[]

const GROUP_FIELDS = [
  ['tagGroups', undefined],
  ['characterGroups', 'exactCharacterIds'],
  ['seriesGroups', 'exactSeriesIds']
] as const

/**
 * The gallery's filters once a new list stands for what it saved: its chip,
 * plus whatever was left out of the list, so the results don't move. Null when
 * that can't be said: taking out one side of an OR has no loose equivalent.
 */
export function appliedAfterSaving(
  filters: MediaFilters,
  draft: FilterListDraft,
  listId: string
): MediaFilters | null {
  const left: MediaFilters = {}

  for (const key of SINGLE_VALUE_KEYS) {
    if (filters[key] !== undefined && draft.filters[key] === undefined) {
      Object.assign(left, { [key]: filters[key] })
    }
  }

  for (const [field, exactField] of GROUP_FIELDS) {
    const groups = filters[field] ?? []
    const saved = new Set(draft.filters[field]?.flat())
    const removed = groups.flat().filter((entry) => !saved.has(entry))
    if (removed.length === 0) continue
    if (groups.length > 1) return null
    left[field] = [removed]
    if (exactField) {
      const ids = removed.map((entry) => parseGroupEntry(entry).id)
      const exact = filters[exactField]?.filter((id) => ids.includes(id))
      if (exact?.length) left[exactField] = exact
    }
  }

  const otherLists = filters.filterListIds?.filter((id) => !draft.includedListIds.includes(id))
  return { ...left, filterListIds: [...(otherLists ?? []), listId] }
}
