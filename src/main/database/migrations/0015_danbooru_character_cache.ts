import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('danbooru_character_cache')
    .addColumn('tag_name', 'text', (col) => col.primaryKey())
    .addColumn('parent_tag', 'text')
    .addColumn('series_json', 'text', (col) => col.notNull().defaultTo('[]'))
    .addColumn('fetched_at', 'integer', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('danbooru_character_cache').execute()
}
