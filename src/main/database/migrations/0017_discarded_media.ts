import { Kysely } from 'kysely'

/**
 * Files taken out of the app (deleted media, or discarded straight from the
 * batch import) stay on disk; this remembers where, so they can be cleaned
 * up later and a batch import doesn't offer them again.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('discarded_media')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('route', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('reason', 'text', (col) => col.notNull())
    .addColumn('discarded_at', 'integer', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('discarded_media').execute()
}
