import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('tag_wiki_cache')
    .addColumn('tag_name', 'text', (col) => col.primaryKey())
    .addColumn('body', 'text', (col) => col.notNull())
    .addColumn('other_names_json', 'text', (col) => col.notNull().defaultTo('[]'))
    .addColumn('fetched_at', 'integer', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('tag_wiki_cache').execute()
}
