import type { Kysely } from 'kysely'
import type { DB, SeriesTable } from '../schema'

export function findAllSeries(db: Kysely<DB>): Promise<SeriesTable[]> {
  return db.selectFrom('series').selectAll().orderBy('name', 'asc').execute()
}

export function findSeriesByIds(db: Kysely<DB>, ids: string[]): Promise<SeriesTable[]> {
  if (!ids.length) return Promise.resolve([])
  return db.selectFrom('series').selectAll().where('id', 'in', ids).execute()
}

export function insertSeries(db: Kysely<DB>, series: SeriesTable): Promise<SeriesTable> {
  return db.insertInto('series').values(series).returningAll().executeTakeFirstOrThrow()
}

export function updateSeries(
  db: Kysely<DB>,
  id: string,
  changes: Partial<Omit<SeriesTable, 'id'>>
): Promise<SeriesTable> {
  return db
    .updateTable('series')
    .set(changes)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function deleteSeries(db: Kysely<DB>, id: string): Promise<void> {
  await db.deleteFrom('series').where('id', '=', id).execute()
}
