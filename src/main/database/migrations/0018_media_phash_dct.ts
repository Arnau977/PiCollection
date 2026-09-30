import { Kysely, sql } from 'kysely'

/**
 * Near-duplicate detection moves from a 9x8 difference hash to a DCT pHash
 * plus the picture's aspect ratio. Old hashes aren't comparable with new
 * ones, so they're cleared and the startup backfill recomputes them (from
 * the files, not re-reading them for SHA-256). `aspect_ratio` is 0 when a
 * file couldn't be decoded, so it isn't retried on every start.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('media').addColumn('aspect_ratio', 'real').execute()
  await sql`UPDATE media SET phash = NULL`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('media').dropColumn('aspect_ratio').execute()
}
