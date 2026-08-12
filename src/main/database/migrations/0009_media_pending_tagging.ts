import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('media')
    .addColumn('pending_tagging', 'integer', (col) => col.notNull().defaultTo(0))
    .execute()

  await db.schema.createIndex('idx_media_pending_tagging').on('media').column('pending_tagging').execute()

  // Mirrors applyMediaFilters' noCharacter/noSeries implementation (media.repository.ts) - an
  // OR of the same two "not in" subqueries, since eb.or([...]) is how this codebase already
  // combines conditions built from the same closed-over `db`.
  await db
    .updateTable('media')
    .set({ pending_tagging: 1 })
    .where((eb) =>
      eb.or([
        eb('id', 'not in', db.selectFrom('media_series').select('media_id')),
        eb('id', 'not in', db.selectFrom('media_character').select('media_id'))
      ])
    )
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_media_pending_tagging').execute()
  await db.schema.alterTable('media').dropColumn('pending_tagging').execute()
}
