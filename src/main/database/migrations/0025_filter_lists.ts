import { Kysely, sql } from 'kysely'

/**
 * Named gallery filters. A list can include others, so shared exclusions live
 * in one place. An included list can't be deleted while something uses it:
 * dropping it would silently change what those lists mean.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('filter_list')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', sql`text collate nocase`, (col) => col.notNull().unique())
    .addColumn('filters_json', 'text', (col) => col.notNull())
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .addColumn('updated_at', 'integer', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('filter_list_include')
    .addColumn('list_id', 'text', (col) =>
      col.notNull().references('filter_list.id').onDelete('cascade')
    )
    .addColumn('included_id', 'text', (col) =>
      col.notNull().references('filter_list.id').onDelete('restrict')
    )
    .addPrimaryKeyConstraint('filter_list_include_pk', ['list_id', 'included_id'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('filter_list_include').execute()
  await db.schema.dropTable('filter_list').execute()
}
