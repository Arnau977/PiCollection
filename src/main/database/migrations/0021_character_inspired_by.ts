import { Kysely } from 'kysely'

/**
 * "Inspired by" between characters - an expy (Evanescia) and the one she's
 * modelled on (Yae Sakura). Not a hierarchy: it never expands searches;
 * it's shown on the character and keeps AI suggestions from applying the
 * original silently when it may really be the expy.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('character_inspired_by')
    .addColumn('character_id', 'text', (col) =>
      col.notNull().references('character.id').onDelete('cascade')
    )
    .addColumn('inspired_by_id', 'text', (col) =>
      col.notNull().references('character.id').onDelete('cascade')
    )
    .addPrimaryKeyConstraint('character_inspired_by_pk', ['character_id', 'inspired_by_id'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('character_inspired_by').execute()
}
