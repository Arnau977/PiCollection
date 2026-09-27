import type { Kysely } from 'kysely'
import type { DanbooruCharacterCacheTable, DB } from '../schema'

export function findCachedCharacters(
  db: Kysely<DB>,
  tagNames: string[]
): Promise<DanbooruCharacterCacheTable[]> {
  if (tagNames.length === 0) return Promise.resolve([])
  return db
    .selectFrom('danbooru_character_cache')
    .selectAll()
    .where('tag_name', 'in', tagNames)
    .execute()
}

export async function upsertCachedCharacters(
  db: Kysely<DB>,
  rows: DanbooruCharacterCacheTable[]
): Promise<void> {
  for (const row of rows) {
    await db
      .insertInto('danbooru_character_cache')
      .values(row)
      .onConflict((oc) =>
        oc.column('tag_name').doUpdateSet({
          parent_tag: row.parent_tag,
          series_json: row.series_json,
          fetched_at: row.fetched_at
        })
      )
      .execute()
  }
}
