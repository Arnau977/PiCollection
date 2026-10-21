import { Kysely } from 'kysely'

/**
 * Automatic tags: a picture's size and whether it really uses transparency,
 * plus the rules mapping such a property to one of the user's tags. Which
 * media a rule tags is worked out at query time (autoTag.repository.ts), so
 * nothing here goes stale when a rule changes. `width` is null until the
 * file is analyzed and 0 when it couldn't be decoded (never retried).
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('media').addColumn('width', 'integer').execute()
  await db.schema.alterTable('media').addColumn('height', 'integer').execute()
  await db.schema.alterTable('media').addColumn('has_alpha', 'integer').execute()
  await db.schema
    .createTable('auto_tag_rule')
    .addColumn('property', 'text', (col) => col.primaryKey())
    .addColumn('tag_id', 'text', (col) => col.notNull().references('tag.id').onDelete('cascade'))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('auto_tag_rule').execute()
  await db.schema.alterTable('media').dropColumn('has_alpha').execute()
  await db.schema.alterTable('media').dropColumn('height').execute()
  await db.schema.alterTable('media').dropColumn('width').execute()
}
