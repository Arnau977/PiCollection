import type { Kysely } from 'kysely'
import type { DB, FilterListIncludeTable, FilterListTable } from '../schema'

export function findAllFilterLists(db: Kysely<DB>): Promise<FilterListTable[]> {
  return db.selectFrom('filter_list').selectAll().orderBy('name', 'asc').execute()
}

export function findFilterListByName(
  db: Kysely<DB>,
  name: string
): Promise<FilterListTable | undefined> {
  return db.selectFrom('filter_list').selectAll().where('name', '=', name).executeTakeFirst()
}

export function findAllFilterListIncludes(db: Kysely<DB>): Promise<FilterListIncludeTable[]> {
  return db.selectFrom('filter_list_include').selectAll().execute()
}

export function insertFilterList(db: Kysely<DB>, list: FilterListTable): Promise<FilterListTable> {
  return db.insertInto('filter_list').values(list).returningAll().executeTakeFirstOrThrow()
}

export function updateFilterList(
  db: Kysely<DB>,
  id: string,
  changes: Partial<Omit<FilterListTable, 'id'>>
): Promise<FilterListTable> {
  return db
    .updateTable('filter_list')
    .set(changes)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function replaceFilterListIncludes(
  db: Kysely<DB>,
  listId: string,
  includedIds: string[]
): Promise<void> {
  await db.deleteFrom('filter_list_include').where('list_id', '=', listId).execute()
  if (!includedIds.length) return
  await db
    .insertInto('filter_list_include')
    .values(includedIds.map((included_id) => ({ list_id: listId, included_id })))
    .execute()
}

export async function deleteFilterList(db: Kysely<DB>, id: string): Promise<void> {
  await db.deleteFrom('filter_list').where('id', '=', id).execute()
}
