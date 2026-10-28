import type { Kysely } from 'kysely'
import type { DB } from '../schema'

/** Every media row's file facts the disk-space overview adds up. */
export function listMediaSizes(db: Kysely<DB>): Promise<
  {
    id: string
    route: string
    file_size?: number | null
    pending_tagging: number
    artist_id: string | null
    type: string
  }[]
> {
  return db
    .selectFrom('media')
    .select(['id', 'route', 'type', 'file_size', 'pending_tagging', 'artist_id'])
    .execute()
}

export function listMediaSeriesLinks(
  db: Kysely<DB>
): Promise<{ media_id: string; entity_id: string }[]> {
  return db.selectFrom('media_series').select(['media_id', 'series_id as entity_id']).execute()
}

export function listMediaCharacterLinks(
  db: Kysely<DB>
): Promise<{ media_id: string; entity_id: string }[]> {
  return db
    .selectFrom('media_character')
    .select(['media_id', 'character_id as entity_id'])
    .execute()
}

export function listNamedEntities(
  db: Kysely<DB>,
  table: 'series' | 'character' | 'artist'
): Promise<{ id: string; name: string; parent_id: string | null }[]> {
  if (table === 'artist') {
    return db
      .selectFrom('artist')
      .select(['id', 'name'])
      .execute()
      .then((rows) => rows.map((row) => ({ ...row, parent_id: null })))
  }
  return db.selectFrom(table).select(['id', 'name', 'parent_id']).execute()
}
