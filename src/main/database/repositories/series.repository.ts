import type { Kysely } from 'kysely'
import type { DB, SeriesTable } from '../schema'

export function findAllSeries(db: Kysely<DB>): Promise<SeriesTable[]> {
  return db.selectFrom('series').selectAll().orderBy('name', 'asc').execute()
}

export function findSeriesByIds(db: Kysely<DB>, ids: string[]): Promise<SeriesTable[]> {
  if (!ids.length) return Promise.resolve([])
  return db.selectFrom('series').selectAll().where('id', 'in', ids).execute()
}

export async function findSeriesHierarchy(
  db: Kysely<DB>
): Promise<{ id: string; parentId: string | null }[]> {
  const rows = await db.selectFrom('series').select(['id', 'parent_id']).execute()
  return rows.map((row) => ({ id: row.id, parentId: row.parent_id }))
}

/** Direct (non-hierarchy-expanded) media_series link count per series, 0 for series with none. */
export async function countMediaPerSeries(db: Kysely<DB>): Promise<Record<string, number>> {
  const rows = await db
    .selectFrom('series')
    .leftJoin('media_series', 'media_series.series_id', 'series.id')
    .select(['series.id as id'])
    .select((eb) => eb.fn.count('media_series.media_id').as('count'))
    .groupBy('series.id')
    .execute()
  return Object.fromEntries(rows.map((row) => [row.id, Number(row.count)]))
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
