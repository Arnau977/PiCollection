import type { Kysely } from 'kysely'
import { libraryCountExpr, pendingCountExpr, toCountsById, type MediaCounts } from './mediaCounts'
import type { DB, TagTable } from '../schema'

export function findAllTags(db: Kysely<DB>): Promise<TagTable[]> {
  return db.selectFrom('tag').selectAll().orderBy('name', 'asc').execute()
}

export function findTagsByIds(db: Kysely<DB>, ids: string[]): Promise<TagTable[]> {
  if (!ids.length) return Promise.resolve([])
  return db.selectFrom('tag').selectAll().where('id', 'in', ids).execute()
}

export function insertTag(db: Kysely<DB>, tag: TagTable): Promise<TagTable> {
  return db.insertInto('tag').values(tag).returningAll().executeTakeFirstOrThrow()
}

export function updateTag(
  db: Kysely<DB>,
  id: string,
  changes: Partial<Omit<TagTable, 'id'>>
): Promise<TagTable> {
  return db
    .updateTable('tag')
    .set(changes)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function deleteTag(db: Kysely<DB>, id: string): Promise<void> {
  await db.deleteFrom('tag').where('id', '=', id).execute()
}

/** Direct media_tag link count per tag, 0 for tags with none. */
export async function countMediaPerTag(db: Kysely<DB>): Promise<Record<string, MediaCounts>> {
  const rows = await db
    .selectFrom('tag')
    .leftJoin('media_tag', 'media_tag.tag_id', 'tag.id')
    .leftJoin('media', 'media.id', 'media_tag.media_id')
    .select(['tag.id as id', libraryCountExpr.as('library'), pendingCountExpr.as('pending')])
    .groupBy('tag.id')
    .execute()
  return toCountsById(rows)
}
