import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('tag')
    .addColumn('created_at', 'integer', (col) => col.notNull().defaultTo(0))
    .execute()

  // Existing tags never recorded a creation time; backfill with "now" so they
  // sort together (by rowid/insertion order as a tiebreak) instead of all
  // landing at epoch 0 ahead of every future tag.
  await db.updateTable('tag').set({ created_at: Date.now() }).execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('tag').dropColumn('created_at').execute()
}
