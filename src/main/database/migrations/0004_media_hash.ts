import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('media').addColumn('hash', 'text').execute()
  await db.schema.alterTable('media').addColumn('phash', 'text').execute()
  // Not unique: duplicate-exact checks happen at the application layer before
  // insert (see media.service.ts) - this index just keeps that lookup fast.
  await db.schema.createIndex('idx_media_hash').on('media').column('hash').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_media_hash').execute()
  await db.schema.alterTable('media').dropColumn('phash').execute()
  await db.schema.alterTable('media').dropColumn('hash').execute()
}
