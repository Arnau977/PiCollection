import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { rmSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import type { Kysely } from 'kysely'
import { createDb } from '../connection'
import { createMigrator } from './migrator'
import type { DB } from '../schema'

let db: Kysely<DB>
let dir: string

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'picollection-migration-test-'))
  db = createDb(path.join(dir, `${randomUUID()}.sqlite`))
})

afterEach(async () => {
  await db.destroy()
  rmSync(dir, { recursive: true, force: true })
})

function insertMedia(id: string, route: string, createdAt: number): Promise<unknown> {
  return db
    .insertInto('media')
    .values({
      id,
      name: id,
      sfw: 1,
      is_ai_generated: 0,
      type: 'image',
      route,
      alias: null,
      artist_id: null,
      created_at: createdAt,
      hash: null,
      phash: null,
      pending_tagging: 1
    })
    .execute()
}

describe('0012_media_route_unique migration', () => {
  it('rejects a second media row sharing an existing route', async () => {
    await createMigrator(db).migrateToLatest()
    await insertMedia('m1', '/dir/a.png', 1)

    await expect(insertMedia('m2', '/dir/a.png', 2)).rejects.toThrow(/unique/i)
  })

  it('collapses pre-existing duplicate routes to the earliest row, merging its tags', async () => {
    const migrator = createMigrator(db)
    await migrator.migrateTo('0011_tag_wiki_cache')

    await insertMedia('keeper', '/dir/a.png', 100)
    await insertMedia('dupe', '/dir/a.png', 200)
    await insertMedia('other', '/dir/b.png', 150)
    await db.insertInto('tag').values({ id: 't1', name: 'blue', aliases_json: '[]', created_at: 1 }).execute()
    await db.insertInto('media_tag').values({ media_id: 'dupe', tag_id: 't1' }).execute()

    await migrator.migrateToLatest()

    const rows = await db.selectFrom('media').select(['id', 'route']).orderBy('route').execute()
    expect(rows).toEqual([
      { id: 'keeper', route: '/dir/a.png' },
      { id: 'other', route: '/dir/b.png' }
    ])
    const tagLinks = await db.selectFrom('media_tag').select(['media_id', 'tag_id']).execute()
    expect(tagLinks).toEqual([{ media_id: 'keeper', tag_id: 't1' }])
  })
})
