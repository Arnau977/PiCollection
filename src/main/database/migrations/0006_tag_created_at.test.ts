import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createTestDb } from '../testHelpers'
import type { DB } from '../schema'

let db: Kysely<DB>
let cleanup: () => Promise<void>

beforeEach(async () => {
  const testDb = await createTestDb()
  db = testDb.db
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
})

describe('0006_tag_created_at migration', () => {
  it('gives every tag a numeric created_at once migrated', async () => {
    const row = await db
      .insertInto('tag')
      .values({ id: 't1', name: 'landscape', created_at: 123 })
      .returningAll()
      .executeTakeFirstOrThrow()

    expect(typeof row.created_at).toBe('number')
    expect(row.created_at).toBe(123)
  })
})
