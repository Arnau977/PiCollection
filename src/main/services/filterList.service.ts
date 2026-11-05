import { randomUUID } from 'crypto'
import type { Kysely } from 'kysely'
import { getDb } from '../database/connection'
import * as artistRepo from '../database/repositories/artist.repository'
import * as characterRepo from '../database/repositories/character.repository'
import * as filterListRepo from '../database/repositories/filterList.repository'
import * as seriesRepo from '../database/repositories/series.repository'
import * as tagRepo from '../database/repositories/tag.repository'
import type { DB, FilterListIncludeTable, FilterListTable } from '../database/schema'
import { notifyEntitiesChanged } from '../events/entityEvents'
import { groupEntityIds } from '@shared/query/groupEntry'
import { hasActiveFilters } from '@shared/query/hasActiveFilters'
import { pruneMissingEntities, type KnownEntityIds } from '@shared/query/pruneMissingEntities'
import type { FilterListInput, FilterListModel, SavedFilters } from '@shared/models'

function parseFilters(row: FilterListTable): SavedFilters {
  return JSON.parse(row.filters_json)
}

function toIdSet(rows: { id: string }[]): Set<string> {
  return new Set(rows.map((row) => row.id))
}

/** Which of the entities these filters mention still exist. */
async function findKnownEntities(db: Kysely<DB>, all: SavedFilters[]): Promise<KnownEntityIds> {
  const artistIds = all.flatMap((filters) => (filters.artistId ? [filters.artistId] : []))
  const tagIds = all.flatMap((filters) => groupEntityIds(filters.tagGroups))
  const characterIds = all.flatMap((filters) => [
    ...groupEntityIds(filters.characterGroups),
    ...(filters.exactCharacterIds ?? [])
  ])
  const seriesIds = all.flatMap((filters) => [
    ...groupEntityIds(filters.seriesGroups),
    ...(filters.exactSeriesIds ?? [])
  ])
  const [artists, tags, characters, series] = await Promise.all([
    artistRepo.findArtistsByIds(db, artistIds),
    tagRepo.findTagsByIds(db, tagIds),
    characterRepo.findCharactersByIds(db, characterIds),
    seriesRepo.findSeriesByIds(db, seriesIds)
  ])
  return {
    artists: toIdSet(artists),
    tags: toIdSet(tags),
    characters: toIdSet(characters),
    series: toIdSet(series)
  }
}

function includesOf(rows: FilterListIncludeTable[], listId: string): string[] {
  return rows.filter((row) => row.list_id === listId).map((row) => row.included_id)
}

/** Throws if saving these includes would make the list contain itself. */
function assertNoCycle(
  listId: string,
  includedIds: string[],
  rows: FilterListIncludeTable[]
): void {
  const seen = new Set<string>()
  const pending = [...includedIds]
  while (pending.length) {
    const id = pending.pop()!
    if (id === listId) throw new Error('A filter list cannot include itself')
    if (seen.has(id)) continue
    seen.add(id)
    pending.push(...includesOf(rows, id))
  }
}

async function validate(db: Kysely<DB>, input: FilterListInput, id?: string): Promise<string> {
  const name = input.name.trim()
  if (!name) throw new Error('A filter list needs a name')
  const sameName = await filterListRepo.findFilterListByName(db, name)
  if (sameName && sameName.id !== id) {
    throw new Error(`A filter list named "${name}" already exists`)
  }
  if (!hasActiveFilters(input.filters) && input.includedListIds.length === 0) {
    throw new Error('A filter list cannot be empty')
  }
  return name
}

async function findById(id: string): Promise<FilterListModel> {
  const all = await filterListService.getAll()
  const list = all.find((candidate) => candidate.id === id)
  if (!list) throw new Error(`Filter list ${id} not found`)
  return list
}

export const filterListService = {
  async getAll(): Promise<FilterListModel[]> {
    const db = getDb()
    const [rows, includes] = await Promise.all([
      filterListRepo.findAllFilterLists(db),
      filterListRepo.findAllFilterListIncludes(db)
    ])
    const known = await findKnownEntities(db, rows.map(parseFilters))
    return rows.map((row) => {
      const filters = parseFilters(row)
      return {
        id: row.id,
        name: row.name,
        filters,
        includedListIds: includesOf(includes, row.id),
        hasMissingEntities: pruneMissingEntities(filters, known) !== filters,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    })
  },

  async create(input: FilterListInput): Promise<FilterListModel> {
    const db = getDb()
    const name = await validate(db, input)
    const now = Date.now()
    const id = randomUUID()
    await db.transaction().execute(async (trx) => {
      await filterListRepo.insertFilterList(trx, {
        id,
        name,
        filters_json: JSON.stringify(input.filters),
        created_at: now,
        updated_at: now
      })
      await filterListRepo.replaceFilterListIncludes(trx, id, input.includedListIds)
    })
    notifyEntitiesChanged(['filterList'])
    return findById(id)
  },

  async update(id: string, input: FilterListInput): Promise<FilterListModel> {
    const db = getDb()
    const name = await validate(db, input, id)
    assertNoCycle(id, input.includedListIds, await filterListRepo.findAllFilterListIncludes(db))
    await db.transaction().execute(async (trx) => {
      await filterListRepo.updateFilterList(trx, id, {
        name,
        filters_json: JSON.stringify(input.filters),
        updated_at: Date.now()
      })
      await filterListRepo.replaceFilterListIncludes(trx, id, input.includedListIds)
    })
    notifyEntitiesChanged(['filterList'])
    return findById(id)
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    const [rows, includes] = await Promise.all([
      filterListRepo.findAllFilterLists(db),
      filterListRepo.findAllFilterListIncludes(db)
    ])
    const usedBy = rows.filter((row) => includesOf(includes, row.id).includes(id))
    if (usedBy.length) {
      const names = usedBy.map((row) => row.name).join(', ')
      throw new Error(`This filter list is included in: ${names}`)
    }
    await filterListRepo.deleteFilterList(db, id)
    notifyEntitiesChanged(['filterList'])
  },

  /**
   * The filters of these lists and everything they include, each list once.
   * Ids that no longer exist are skipped, and so are entities a list still
   * mentions but that were deleted.
   */
  async resolve(listIds: string[]): Promise<SavedFilters[]> {
    const db = getDb()
    const [rows, includes] = await Promise.all([
      filterListRepo.findAllFilterLists(db),
      filterListRepo.findAllFilterListIncludes(db)
    ])
    const byId = new Map(rows.map((row) => [row.id, row]))
    const seen = new Set<string>()
    const pending = [...listIds]
    const resolved: SavedFilters[] = []
    while (pending.length) {
      const id = pending.pop()!
      const row = byId.get(id)
      if (!row || seen.has(id)) continue
      seen.add(id)
      resolved.push(parseFilters(row))
      pending.push(...includesOf(includes, id))
    }
    const known = await findKnownEntities(db, resolved)
    return resolved.map((filters) => pruneMissingEntities(filters, known))
  }
}
