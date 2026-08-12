import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('character')
    .addColumn('parent_id', 'text', (col) => col.references('character.id').onDelete('set null'))
    .execute()

  await db.schema.createIndex('idx_character_parent').on('character').column('parent_id').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_character_parent').execute()
  await db.schema.alterTable('character').dropColumn('parent_id').execute()
}
