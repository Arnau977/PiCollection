import { Kysely, sql } from 'kysely'

/**
 * Animated WebPs are now stored as GIFs. Clearing the size of every WebP
 * saved as a picture puts it back in the background analysis queue, which
 * reads the animation flag along with size and transparency.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`UPDATE media SET width = NULL, height = NULL, has_alpha = NULL
    WHERE type = 'image' AND lower(route) LIKE '%.webp'`.execute(db)
}

export async function down(): Promise<void> {
  // Nothing to restore: the old values are read again from the files.
}
