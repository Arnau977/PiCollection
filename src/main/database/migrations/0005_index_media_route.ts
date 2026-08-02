import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // route is now looked up on every duplicate-check (findMediaRowByRoute) and
  // will be looked up again by Phase 2's folder browser - this keeps that
  // fast regardless of whether the stored value is relative or absolute.
  await db.schema.createIndex('idx_media_route').on('media').column('route').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_media_route').execute()
}
