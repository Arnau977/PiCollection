import type { Kysely } from 'kysely'
import type { DB, DiscardedMediaTable } from '../schema'

const ROUTES_CHUNK_SIZE = 500

/** Discarding a route again (e.g. re-added, then deleted) just refreshes its row. */
export async function upsertDiscarded(db: Kysely<DB>, row: DiscardedMediaTable): Promise<void> {
  await db
    .insertInto('discarded_media')
    .values(row)
    .onConflict((oc) =>
      oc.column('route').doUpdateSet({
        name: row.name,
        type: row.type,
        reason: row.reason,
        discarded_at: row.discarded_at
      })
    )
    .execute()
}

export function listDiscarded(db: Kysely<DB>): Promise<DiscardedMediaTable[]> {
  return db.selectFrom('discarded_media').selectAll().orderBy('discarded_at', 'desc').execute()
}

export function findDiscardedById(
  db: Kysely<DB>,
  id: string
): Promise<DiscardedMediaTable | undefined> {
  return db.selectFrom('discarded_media').selectAll().where('id', '=', id).executeTakeFirst()
}

export async function deleteDiscarded(db: Kysely<DB>, id: string): Promise<void> {
  await db.deleteFrom('discarded_media').where('id', '=', id).execute()
}

export async function deleteDiscardedByRoute(db: Kysely<DB>, route: string): Promise<void> {
  await db.deleteFrom('discarded_media').where('route', '=', route).execute()
}

/** Which of `routes` are discarded - chunked like media.repository's routesExist. */
export async function discardedRoutes(db: Kysely<DB>, routes: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (let i = 0; i < routes.length; i += ROUTES_CHUNK_SIZE) {
    const chunk = routes.slice(i, i + ROUTES_CHUNK_SIZE)
    const rows = await db
      .selectFrom('discarded_media')
      .select('route')
      .where('route', 'in', chunk)
      .execute()
    for (const row of rows) found.add(row.route)
  }
  return found
}
