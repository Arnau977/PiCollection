import { Kysely } from 'kysely'

/**
 * Each media file's size on disk in bytes, for sorting the gallery by weight
 * and the disk-space overview. Null until read: fileSizes.service.ts fills it
 * in the background, for the existing library and every new or replaced file.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('media').addColumn('file_size', 'integer').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('media').dropColumn('file_size').execute()
}
