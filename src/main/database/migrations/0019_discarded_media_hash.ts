import { Kysely } from 'kysely'

/**
 * Remembers a discarded file's content (SHA-256), not just its route, so the
 * source-folder watcher still recognizes it after it's moved or renamed.
 * Older rows stay null and keep matching by route only.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('discarded_media').addColumn('hash', 'text').execute()
  await db.schema
    .createIndex('idx_discarded_media_hash')
    .on('discarded_media')
    .column('hash')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_discarded_media_hash').execute()
  await db.schema.alterTable('discarded_media').dropColumn('hash').execute()
}
