import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('artist')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('artist_social_link')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('artist_id', 'text', (col) =>
      col.notNull().references('artist.id').onDelete('cascade')
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('icon', 'text')
    .addColumn('position', 'integer', (col) => col.notNull().defaultTo(0))
    .execute()
  await db.schema
    .createIndex('idx_artist_social_link_artist')
    .on('artist_social_link')
    .column('artist_id')
    .execute()

  await db.schema
    .createTable('character')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('series_json', 'text', (col) => col.notNull().defaultTo('[]'))
    .addColumn('aliases_json', 'text', (col) => col.notNull().defaultTo('[]'))
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('tag')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .execute()

  await db.schema
    .createTable('media')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('sfw', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('route', 'text', (col) => col.notNull())
    .addColumn('alias', 'text')
    .addColumn('artist_id', 'text', (col) => col.references('artist.id').onDelete('set null'))
    .addColumn('created_at', 'integer', (col) => col.notNull())
    .addCheckConstraint('media_type_check', sql`type in ('image', 'video', 'gif')`)
    .execute()

  await db.schema.createIndex('idx_media_artist').on('media').column('artist_id').execute()
  await db.schema.createIndex('idx_media_sfw').on('media').column('sfw').execute()
  await db.schema.createIndex('idx_media_type').on('media').column('type').execute()
  await db.schema.createIndex('idx_media_created_at').on('media').column('created_at').execute()

  await db.schema
    .createTable('media_tag')
    .addColumn('media_id', 'text', (col) =>
      col.notNull().references('media.id').onDelete('cascade')
    )
    .addColumn('tag_id', 'text', (col) => col.notNull().references('tag.id').onDelete('cascade'))
    .addPrimaryKeyConstraint('media_tag_pk', ['media_id', 'tag_id'])
    .execute()
  await db.schema.createIndex('idx_media_tag_tag').on('media_tag').column('tag_id').execute()

  await db.schema
    .createTable('media_character')
    .addColumn('media_id', 'text', (col) =>
      col.notNull().references('media.id').onDelete('cascade')
    )
    .addColumn('character_id', 'text', (col) =>
      col.notNull().references('character.id').onDelete('cascade')
    )
    .addPrimaryKeyConstraint('media_character_pk', ['media_id', 'character_id'])
    .execute()
  await db.schema
    .createIndex('idx_media_character_character')
    .on('media_character')
    .column('character_id')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('media_character').execute()
  await db.schema.dropTable('media_tag').execute()
  await db.schema.dropTable('media').execute()
  await db.schema.dropTable('tag').execute()
  await db.schema.dropTable('character').execute()
  await db.schema.dropTable('artist_social_link').execute()
  await db.schema.dropTable('artist').execute()
}
