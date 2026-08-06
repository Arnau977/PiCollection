import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('series')
    .addColumn('parent_id', 'text', (col) => col.references('series.id').onDelete('set null'))
    .execute()

  await db.schema.createIndex('idx_series_parent').on('series').column('parent_id').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_series_parent').execute()
  await db.schema.alterTable('series').dropColumn('parent_id').execute()
}
