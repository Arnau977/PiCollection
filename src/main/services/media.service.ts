import { randomUUID } from 'crypto'
import type { Kysely } from 'kysely'
import { getDb } from '../database/connection'
import * as mediaRepo from '../database/repositories/media.repository'
import * as artistRepo from '../database/repositories/artist.repository'
import * as tagRepo from '../database/repositories/tag.repository'
import * as characterRepo from '../database/repositories/character.repository'
import * as seriesRepo from '../database/repositories/series.repository'
import { buildSeriesClosureMap } from '../database/repositories/seriesHierarchy'
import { AppError } from '../errors'
import {
  computeFileHash,
  computePerceptualHash,
  hammingDistance,
  PHASH_SIMILAR_THRESHOLD
} from './mediaHash'
import { readSourceFolder, relativizeRoute } from './sourceFolder'
import type {
  ArtistModel,
  CharacterModel,
  MediaDuplicateCheck,
  MediaFilteredResult,
  MediaFilters,
  MediaInput,
  MediaModel,
  SeriesModel,
  Sorting,
  TagModel
} from '@shared/models'
import type { DB, MediaTable } from '../database/schema'

async function hydrateMedia(db: Kysely<DB>, rows: MediaTable[]): Promise<MediaModel[]> {
  if (!rows.length) return []

  const mediaIds = rows.map((row) => row.id)
  const artistIds = [
    ...new Set(rows.map((row) => row.artist_id).filter((id): id is string => !!id))
  ]

  const [tagsByMedia, charactersByMedia, seriesByMedia, artistRows, socialLinks] =
    await Promise.all([
      mediaRepo.findTagsForMediaIds(db, mediaIds),
      mediaRepo.findCharactersForMediaIds(db, mediaIds),
      mediaRepo.findSeriesForMediaIds(db, mediaIds),
      artistRepo.findArtistsByIds(db, artistIds),
      artistRepo.findSocialLinksForArtistIds(db, artistIds)
    ])

  const artistById = new Map(artistRows.map((artist) => [artist.id, artist]))

  return rows.map((row): MediaModel => {
    const tags: TagModel[] = (tagsByMedia.get(row.id) ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      createdAt: tag.created_at
    }))
    const characters: CharacterModel[] = (charactersByMedia.get(row.id) ?? []).map((character) => ({
      id: character.id,
      name: character.name,
      series: [],
      aliases: JSON.parse(character.aliases_json),
      createdAt: character.created_at
    }))
    const series: SeriesModel[] = (seriesByMedia.get(row.id) ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      aliases: JSON.parse(s.aliases_json),
      createdAt: s.created_at
    }))

    let artist: ArtistModel | undefined
    if (row.artist_id) {
      const artistRow = artistById.get(row.artist_id)
      if (artistRow) {
        artist = {
          id: artistRow.id,
          name: artistRow.name,
          createdAt: artistRow.created_at,
          socials: socialLinks
            .filter((link) => link.artist_id === artistRow.id)
            .map((link) => ({
              id: link.id,
              name: link.name,
              url: link.url,
              icon: link.icon ?? undefined
            }))
        }
      }
    }

    return {
      id: row.id,
      name: row.name,
      type: row.type as MediaModel['type'],
      route: row.route,
      alias: row.alias ?? undefined,
      sfw: row.sfw === 1,
      isAiGenerated: row.is_ai_generated === 1,
      createdAt: row.created_at,
      artist,
      tags,
      characters,
      series
    }
  })
}

async function getMediaModelById(db: Kysely<DB>, id: string): Promise<MediaModel | null> {
  const row = await mediaRepo.findMediaRowById(db, id)
  if (!row) return null
  const [hydrated] = await hydrateMedia(db, [row])
  return hydrated
}

async function assertRelationsExist(
  db: Kysely<DB>,
  input: Pick<MediaInput, 'artistId' | 'tagIds' | 'characterIds' | 'seriesIds'>
): Promise<void> {
  if (input.artistId) {
    const artist = await artistRepo.findArtistById(db, input.artistId)
    if (!artist) throw new Error(`Artist "${input.artistId}" does not exist`)
  }
  if (input.tagIds?.length) {
    const tags = await tagRepo.findTagsByIds(db, input.tagIds)
    if (tags.length !== input.tagIds.length) throw new Error('One or more tags do not exist')
  }
  if (input.characterIds?.length) {
    const characters = await characterRepo.findCharactersByIds(db, input.characterIds)
    if (characters.length !== input.characterIds.length) {
      throw new Error('One or more characters do not exist')
    }
  }
  if (input.seriesIds?.length) {
    const series = await seriesRepo.findSeriesByIds(db, input.seriesIds)
    if (series.length !== input.seriesIds.length) {
      throw new Error('One or more series do not exist')
    }
  }
}

const SIMILAR_MATCH_LIMIT = 5

/**
 * Finds an existing media row that's either the same file (by path or exact
 * content hash) or visually similar (perceptual hash). Used both by the
 * renderer's pre-submit check and, for the exact case, again inside
 * addMedia() itself as a race-safety net. `absoluteRoute` is always a real
 * filesystem path (hashing needs it); `storageRoute` is what's actually
 * saved in the DB, which the exact-route lookup must match against instead.
 */
async function findDuplicates(
  db: Kysely<DB>,
  absoluteRoute: string,
  sourceFolder: string | null
): Promise<{ exactRow: MediaTable | undefined; hash: string | null; phash: string | null }> {
  const storageRoute = relativizeRoute(absoluteRoute, sourceFolder)
  const byRoute = await mediaRepo.findMediaRowByRoute(db, storageRoute)
  if (byRoute) return { exactRow: byRoute, hash: null, phash: null }

  const hash = await computeFileHash(absoluteRoute)
  if (hash) {
    const byHash = await mediaRepo.findMediaRowByHash(db, hash)
    if (byHash) return { exactRow: byHash, hash, phash: null }
  }

  const phash = hash ? await computePerceptualHash(absoluteRoute) : null
  return { exactRow: undefined, hash, phash }
}

export const mediaService = {
  async checkDuplicate(route: string): Promise<MediaDuplicateCheck> {
    const db = getDb()
    const { exactRow, phash } = await findDuplicates(db, route, readSourceFolder())

    if (exactRow) {
      return { exactMatch: await getMediaModelById(db, exactRow.id), similar: [] }
    }
    if (!phash) {
      return { exactMatch: null, similar: [] }
    }

    const candidates = await mediaRepo.listAllMediaHashes(db)
    const scored = candidates
      .map((row) => ({ id: row.id, distance: hammingDistance(phash, row.phash as string) }))
      .filter((row) => row.distance <= PHASH_SIMILAR_THRESHOLD)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, SIMILAR_MATCH_LIMIT)

    const similar = (
      await Promise.all(
        scored.map(async (row) => {
          const media = await getMediaModelById(db, row.id)
          return media ? { media, distance: row.distance } : null
        })
      )
    ).filter((entry): entry is { media: MediaModel; distance: number } => entry !== null)

    return { exactMatch: null, similar }
  },

  async getMediaFiltered(filters: MediaFilters, sorting?: Sorting): Promise<MediaFilteredResult> {
    const db = getDb()
    const flatSeriesIds = filters.seriesGroups?.flat() ?? []
    const seriesClosures = flatSeriesIds.length
      ? buildSeriesClosureMap(await seriesRepo.findSeriesHierarchy(db), flatSeriesIds)
      : undefined
    const [rows, total] = await Promise.all([
      mediaRepo.findMediaRows(db, filters, sorting, seriesClosures),
      mediaRepo.countMediaRows(db, filters, seriesClosures)
    ])
    const items = await hydrateMedia(db, rows)
    return { items, total }
  },

  async getMediaById(id: string): Promise<MediaModel | null> {
    return getMediaModelById(getDb(), id)
  },

  async addMedia(input: MediaInput): Promise<MediaModel> {
    const db = getDb()
    await assertRelationsExist(db, input)
    const sourceFolder = readSourceFolder()

    // Repeats the exact-match half of checkDuplicate() as a race-safety net
    // (the renderer already showed a warning/block from its own pre-submit
    // call) - the perceptual "similar" check is advisory-only and never
    // blocks an insert.
    const { exactRow, hash, phash } = await findDuplicates(db, input.route, sourceFolder)
    if (exactRow) {
      throw new AppError(
        'DUPLICATE_MEDIA',
        `This file is already in the library as "${exactRow.name}".`
      )
    }

    const id = randomUUID()
    await db.transaction().execute(async (trx) => {
      await mediaRepo.insertMediaRow(trx, {
        id,
        name: input.name,
        sfw: input.sfw ? 1 : 0,
        is_ai_generated: input.isAiGenerated ? 1 : 0,
        type: input.type,
        route: relativizeRoute(input.route, sourceFolder),
        alias: input.alias ?? null,
        artist_id: input.artistId ?? null,
        created_at: Date.now(),
        hash,
        phash
      })
      if (input.tagIds?.length) await mediaRepo.setMediaTags(trx, id, input.tagIds)
      if (input.characterIds?.length)
        await mediaRepo.setMediaCharacters(trx, id, input.characterIds)
      if (input.seriesIds?.length) await mediaRepo.setMediaSeries(trx, id, input.seriesIds)
    })

    const created = await getMediaModelById(db, id)
    if (!created) throw new Error('Failed to load created media')
    return created
  },

  async updateMedia(id: string, input: MediaInput): Promise<MediaModel> {
    const db = getDb()
    await assertRelationsExist(db, input)
    const sourceFolder = readSourceFolder()

    await db.transaction().execute(async (trx) => {
      await mediaRepo.updateMediaRow(trx, id, {
        name: input.name,
        sfw: input.sfw ? 1 : 0,
        is_ai_generated: input.isAiGenerated ? 1 : 0,
        type: input.type,
        route: relativizeRoute(input.route, sourceFolder),
        alias: input.alias ?? null,
        artist_id: input.artistId ?? null
      })
      await mediaRepo.setMediaTags(trx, id, input.tagIds ?? [])
      await mediaRepo.setMediaCharacters(trx, id, input.characterIds ?? [])
      await mediaRepo.setMediaSeries(trx, id, input.seriesIds ?? [])
    })

    const updated = await getMediaModelById(db, id)
    if (!updated) throw new Error('Failed to load updated media')
    return updated
  },

  async deleteMedia(id: string): Promise<void> {
    await mediaRepo.deleteMediaRow(getDb(), id)
  },

  async getEntityThumbnails(
    kind: 'artist' | 'tag' | 'character' | 'series',
    ids: string[]
  ): Promise<{ entityId: string; route: string; type: string }[]> {
    return mediaRepo.findEntityThumbnails(getDb(), kind, ids)
  }
}
