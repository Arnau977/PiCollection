import { promises as fs } from 'fs'
import type { StorageEntity, StorageFolder, StorageOverview, StorageTotal } from '@shared/models'
import { getDb } from '../database/connection'
import * as discardedRepo from '../database/repositories/discardedMedia.repository'
import * as storageRepo from '../database/repositories/storage.repository'
import { readSourceFolder, resolveRoute } from './sourceFolder'

interface MediaSize {
  id: string
  route: string
  file_size?: number | null
  pending_tagging: number
  artist_id: string | null
}

interface NamedEntity {
  id: string
  name: string
  parent_id: string | null
}

export interface StorageInput {
  media: MediaSize[]
  seriesLinks: { media_id: string; entity_id: string }[]
  characterLinks: { media_id: string; entity_id: string }[]
  series: NamedEntity[]
  characters: NamedEntity[]
  artists: NamedEntity[]
}

const ABSOLUTE = /^([a-z]:|[\\/])/i

/**
 * Folders a route counts towards: for one under the source folder, the
 * source folder itself ('') and every folder down to its own; for one
 * outside it, just its own full folder.
 */
function foldersOf(route: string): string[] {
  const parts = route.split(/[\\/]+/)
  parts.pop()
  if (ABSOLUTE.test(route)) return [parts.join('\\')]
  return parts.map((_, i) => parts.slice(0, i + 1).join('\\')).concat('')
}

function add(totals: Map<string, StorageTotal>, key: string, bytes: number): void {
  const total = totals.get(key) ?? { bytes: 0, count: 0 }
  total.bytes += bytes
  total.count += 1
  totals.set(key, total)
}

/**
 * An entity's media through the hierarchy, like the gallery's group filters
 * and the Metadata counts: a series gets its subseries' media too, each
 * media once however many of its links meet there.
 */
function entityTotals(
  library: Map<string, number>,
  links: { media_id: string; entity_id: string }[],
  entities: NamedEntity[]
): StorageEntity[] {
  const parentOf = new Map(entities.map((entity) => [entity.id, entity.parent_id]))
  const reach = new Map<string, Set<string>>()
  for (const link of links) {
    if (!library.has(link.media_id)) continue
    const under = reach.get(link.media_id) ?? new Set<string>()
    for (
      let id: string | null | undefined = link.entity_id;
      id && !under.has(id);
      id = parentOf.get(id)
    ) {
      under.add(id)
    }
    reach.set(link.media_id, under)
  }
  const totals = new Map<string, StorageTotal>()
  for (const [mediaId, ids] of reach) {
    for (const id of ids) add(totals, id, library.get(mediaId) ?? 0)
  }
  return sortedEntities(totals, entities)
}

function sortedEntities(
  totals: Map<string, StorageTotal>,
  entities: NamedEntity[]
): StorageEntity[] {
  const names = new Map(entities.map((entity) => [entity.id, entity.name]))
  return [...totals]
    .filter(([id]) => names.has(id))
    .map(([id, total]) => ({ id, name: names.get(id) as string, ...total }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
}

/** Pure: adds the library up by folder, series, character and artist. */
export function aggregateStorage(input: StorageInput): Omit<StorageOverview, 'discarded'> {
  const library = new Map<string, number>()
  const folders = new Map<string, StorageTotal>()
  const artists = new Map<string, StorageTotal>()
  const pending: StorageTotal = { bytes: 0, count: 0 }
  let libraryBytes = 0
  let unmeasured = 0

  for (const media of input.media) {
    const bytes = media.file_size ?? 0
    if (media.pending_tagging === 1) {
      pending.bytes += bytes
      pending.count += 1
      continue
    }
    library.set(media.id, bytes)
    libraryBytes += bytes
    if (media.file_size == null) unmeasured += 1
    for (const folder of foldersOf(media.route)) add(folders, folder, bytes)
    if (media.artist_id) add(artists, media.artist_id, bytes)
  }

  const folderList: StorageFolder[] = [...folders]
    .map(([path, total]) => ({ path, ...total }))
    .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path))

  return {
    library: { bytes: libraryBytes, count: library.size, unmeasured },
    pending,
    folders: folderList,
    series: entityTotals(library, input.seriesLinks, input.series),
    characters: entityTotals(library, input.characterLinks, input.characters),
    artists: sortedEntities(artists, input.artists)
  }
}

/** Deleted media whose files are still on disk: what emptying them to the Recycle Bin would free. */
async function discardedOnDisk(): Promise<StorageTotal> {
  const sourceFolder = readSourceFolder()
  const total: StorageTotal = { bytes: 0, count: 0 }
  for (const row of await discardedRepo.listDiscarded(getDb())) {
    const stat = await fs.stat(resolveRoute(row.route, sourceFolder)).catch(() => null)
    if (!stat?.isFile()) continue
    total.bytes += stat.size
    total.count += 1
  }
  return total
}

export const storageService = {
  async getOverview(): Promise<StorageOverview> {
    const db = getDb()
    const [media, seriesLinks, characterLinks, series, characters, artists, discarded] =
      await Promise.all([
        storageRepo.listMediaSizes(db),
        storageRepo.listMediaSeriesLinks(db),
        storageRepo.listMediaCharacterLinks(db),
        storageRepo.listNamedEntities(db, 'series'),
        storageRepo.listNamedEntities(db, 'character'),
        storageRepo.listNamedEntities(db, 'artist'),
        discardedOnDisk()
      ])
    return {
      ...aggregateStorage({ media, seriesLinks, characterLinks, series, characters, artists }),
      discarded
    }
  }
}
