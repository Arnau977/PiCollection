import type { Kysely } from 'kysely'
import type { DB } from '../schema'

export interface EntityCountRow {
  id: string
  name: string
  count: number
}

export async function topArtistsByMediaCount(
  db: Kysely<DB>,
  limit: number
): Promise<EntityCountRow[]> {
  const rows = await db
    .selectFrom('media')
    .innerJoin('artist', 'artist.id', 'media.artist_id')
    .select(['artist.id as id', 'artist.name as name'])
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .groupBy(['artist.id', 'artist.name'])
    .orderBy('count', 'desc')
    .limit(limit)
    .execute()
  return rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.count) }))
}

export async function topTagsByMediaCount(
  db: Kysely<DB>,
  limit: number
): Promise<EntityCountRow[]> {
  const rows = await db
    .selectFrom('media_tag')
    .innerJoin('tag', 'tag.id', 'media_tag.tag_id')
    .select(['tag.id as id', 'tag.name as name'])
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .groupBy(['tag.id', 'tag.name'])
    .orderBy('count', 'desc')
    .limit(limit)
    .execute()
  return rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.count) }))
}

export async function topCharactersByMediaCount(
  db: Kysely<DB>,
  limit: number
): Promise<EntityCountRow[]> {
  const rows = await db
    .selectFrom('media_character')
    .innerJoin('character', 'character.id', 'media_character.character_id')
    .select(['character.id as id', 'character.name as name'])
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .groupBy(['character.id', 'character.name'])
    .orderBy('count', 'desc')
    .limit(limit)
    .execute()
  return rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.count) }))
}

export async function topSeriesByMediaCount(
  db: Kysely<DB>,
  limit: number
): Promise<EntityCountRow[]> {
  const rows = await db
    .selectFrom('media_series')
    .innerJoin('series', 'series.id', 'media_series.series_id')
    .select(['series.id as id', 'series.name as name'])
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .groupBy(['series.id', 'series.name'])
    .orderBy('count', 'desc')
    .limit(limit)
    .execute()
  return rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.count) }))
}
