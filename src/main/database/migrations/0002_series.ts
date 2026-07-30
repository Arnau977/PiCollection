import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('series')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('aliases_json', 'text', (col) => col.notNull().defaultTo('[]'))
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('character_series')
    .addColumn('character_id', 'text', (col) =>
      col.notNull().references('character.id').onDelete('cascade')
    )
    .addColumn('series_id', 'text', (col) =>
      col.notNull().references('series.id').onDelete('cascade')
    )
    .addPrimaryKeyConstraint('character_series_pk', ['character_id', 'series_id'])
    .execute()
  await db.schema
    .createIndex('idx_character_series_series')
    .on('character_series')
    .column('series_id')
    .execute()

  await db.schema
    .createTable('media_series')
    .addColumn('media_id', 'text', (col) =>
      col.notNull().references('media.id').onDelete('cascade')
    )
    .addColumn('series_id', 'text', (col) =>
      col.notNull().references('series.id').onDelete('cascade')
    )
    .addPrimaryKeyConstraint('media_series_pk', ['media_id', 'series_id'])
    .execute()
  await db.schema
    .createIndex('idx_media_series_series')
    .on('media_series')
    .column('series_id')
    .execute()

  await db.schema.alterTable('character').dropColumn('series_json').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('character')
    .addColumn('series_json', 'text', (col) => col.notNull().defaultTo('[]'))
    .execute()
  await db.schema.dropTable('media_series').execute()
  await db.schema.dropTable('character_series').execute()
  await db.schema.dropTable('series').execute()
}
