import type { Kysely } from 'kysely'
import type { DB, TagWikiCacheTable } from '../schema'

export function findCachedTagWiki(
  db: Kysely<DB>,
  tagName: string
): Promise<TagWikiCacheTable | undefined> {
  return db
    .selectFrom('tag_wiki_cache')
    .selectAll()
    .where('tag_name', '=', tagName)
    .executeTakeFirst()
}

export function upsertTagWiki(
  db: Kysely<DB>,
  row: TagWikiCacheTable
): Promise<TagWikiCacheTable> {
  return db
    .insertInto('tag_wiki_cache')
    .values(row)
    .onConflict((oc) =>
      oc.column('tag_name').doUpdateSet({
        body: row.body,
        other_names_json: row.other_names_json,
        fetched_at: row.fetched_at
      })
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}
