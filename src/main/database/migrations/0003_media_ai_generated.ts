import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('media')
    .addColumn('is_ai_generated', 'integer', (col) => col.notNull().defaultTo(0))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('media').dropColumn('is_ai_generated').execute()
}
