import { Kysely, sql } from 'kysely'

/**
 * `media.route` is the identity of a catalogued file, but nothing enforced it:
 * a concurrent batch import ("add remaining to pending") could run its
 * duplicate check and its insert interleaved with another copy of itself and
 * land two rows for the same path. This makes that impossible.
 *
 * Existing duplicates are collapsed first, keeping the earliest-created row
 * per route and re-pointing its tag/character/series links onto the keeper
 * (artist/alias stay the keeper's - for an identical file path they don't
 * realistically diverge). Then the non-unique `idx_media_route` from
 * migration 0005 is replaced with a UNIQUE index, which also still serves the
 * route lookups it was created for.
 */
export async function up(db: Kysely<any>): Promise<void> {
  const dupeRoutes = await db
    .selectFrom('media')
    .select('route')
    .groupBy('route')
    .having(sql`count(*)`, '>', 1)
    .execute()

  const junctions = [
    { table: 'media_tag', fk: 'tag_id' },
    { table: 'media_character', fk: 'character_id' },
    { table: 'media_series', fk: 'series_id' }
  ] as const

  for (const { route } of dupeRoutes) {
    const rows = await db
      .selectFrom('media')
      .select('id')
      .where('route', '=', route)
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .execute()
    const keeperId = rows[0].id as string
    const victimIds = rows.slice(1).map((r: { id: string }) => r.id)

    for (const { table, fk } of junctions) {
      await sql`
        INSERT OR IGNORE INTO ${sql.table(table)} (media_id, ${sql.ref(fk)})
        SELECT ${keeperId}, ${sql.ref(fk)}
        FROM ${sql.table(table)}
        WHERE media_id IN (${sql.join(victimIds)})
      `.execute(db)
      await sql`DELETE FROM ${sql.table(table)} WHERE media_id IN (${sql.join(victimIds)})`.execute(
        db
      )
    }

    await db.deleteFrom('media').where('id', 'in', victimIds).execute()
  }

  await db.schema.dropIndex('idx_media_route').execute()
  await db.schema
    .createIndex('idx_media_route_unique')
    .on('media')
    .column('route')
    .unique()
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_media_route_unique').execute()
  await db.schema.createIndex('idx_media_route').on('media').column('route').execute()
}
