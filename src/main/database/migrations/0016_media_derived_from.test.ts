import { describe, expect, it } from 'vitest'
import { createTestDb } from '../testHelpers'
import { up } from './0016_media_derived_from'

describe('0016_media_derived_from migration', () => {
  it('links GIFs made before it to their video by the converter naming', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const media = (id: string, type: string, route: string) => ({
        id,
        name: id,
        type,
        route,
        sfw: 1,
        is_ai_generated: 0,
        created_at: 1,
        pending_tagging: 0
      })
      await db
        .insertInto('media')
        .values([
          media('video', 'video', 'Web Imports/clip.mp4'),
          media('gif1', 'gif', 'Web Imports/clip (GIF).gif'),
          media('gif2', 'gif', 'Web Imports/clip (GIF 2).gif'),
          media('other', 'gif', 'Web Imports/unrelated.gif')
        ])
        .execute()
      // Re-running the backfill on rows inserted after the schema migration.
      await db.schema.dropIndex('idx_media_derived_from').execute()
      await db.schema.alterTable('media').dropColumn('derived_from_id').execute()
      await up(db)

      const rows = await db.selectFrom('media').select(['id', 'derived_from_id']).execute()
      expect(Object.fromEntries(rows.map((row) => [row.id, row.derived_from_id]))).toEqual({
        video: null,
        gif1: 'video',
        gif2: 'video',
        other: null
      })
    } finally {
      await cleanup()
    }
  })
})
