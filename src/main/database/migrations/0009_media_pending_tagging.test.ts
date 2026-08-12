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

// `db`'s runtime schema here is whatever migrateTo('0008_character_parent') left it at -
// pre-`pending_tagging` - which doesn't structurally match the current `DB` type Kysely
// checks every `.insertInto` call against, hence the `as any` escape hatch.
function insertMediaAt0008(id: string, name: string): Promise<unknown> {
  return db
    .insertInto('media')
    .values({ id, name, sfw: 1, type: 'image', route: `/${name}.png`, created_at: Date.now() } as any)
    .execute()
}

describe('0009_media_pending_tagging migration', () => {
  it('defaults pending_tagging to 0 for a freshly-created row post-migration', async () => {
    const migrator = createMigrator(db)
    await migrator.migrateToLatest()

    const row = await db
      .insertInto('media')
      .values({
        id: 'm1',
        name: 'fresh',
        sfw: 1,
        is_ai_generated: 0,
        type: 'image',
        route: '/fresh.png',
        alias: null,
        artist_id: null,
        created_at: Date.now(),
        hash: null,
        phash: null,
        pending_tagging: 0
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    expect(row.pending_tagging).toBe(0)
  })

  it('backfills pending_tagging=1 for pre-existing media missing a series or a character', async () => {
    const migrator = createMigrator(db)
    await migrator.migrateTo('0008_character_parent')

    await insertMediaAt0008('bare', 'bare')
    await insertMediaAt0008('withSeriesOnly', 'withSeriesOnly')
    await insertMediaAt0008('withCharacterOnly', 'withCharacterOnly')
    await insertMediaAt0008('withBoth', 'withBoth')

    await db
      .insertInto('series')
      .values({ id: 's1', name: 'Some Series', aliases_json: '[]', created_at: Date.now(), parent_id: null })
      .execute()
    await db
      .insertInto('character')
      .values({
        id: 'c1',
        name: 'Some Character',
        aliases_json: '[]',
        created_at: Date.now(),
        parent_id: null
      })
      .execute()
    await db.insertInto('media_series').values({ media_id: 'withSeriesOnly', series_id: 's1' }).execute()
    await db
      .insertInto('media_character')
      .values({ media_id: 'withCharacterOnly', character_id: 'c1' })
      .execute()
    await db.insertInto('media_series').values({ media_id: 'withBoth', series_id: 's1' }).execute()
    await db
      .insertInto('media_character')
      .values({ media_id: 'withBoth', character_id: 'c1' })
      .execute()

    await migrator.migrateToLatest()

    const rows = await db.selectFrom('media').select(['id', 'pending_tagging']).execute()
    const byId = new Map(rows.map((r) => [r.id, r.pending_tagging]))
    expect(byId.get('bare')).toBe(1)
    expect(byId.get('withSeriesOnly')).toBe(1)
    expect(byId.get('withCharacterOnly')).toBe(1)
    expect(byId.get('withBoth')).toBe(0)
  })
})
