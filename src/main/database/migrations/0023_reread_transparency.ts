import { Kysely, sql } from 'kysely'

/**
 * Transparency used to mean "any pixel isn't fully opaque", which flagged
 * pictures whose alpha channel only holds export noise (alpha 247-254).
 * Pictures marked transparent are read again under the new rule; clearing
 * their size puts them back in the background analysis queue.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`UPDATE media SET width = NULL, height = NULL, has_alpha = NULL WHERE has_alpha = 1`.execute(
    db
  )
}

export async function down(): Promise<void> {
  // Nothing to restore: the old values are read again from the files.
}
