import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('tag')
    .addColumn('aliases_json', 'text', (col) => col.notNull().defaultTo('[]'))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('tag').dropColumn('aliases_json').execute()
}
