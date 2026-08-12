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

describe('0008_character_parent migration', () => {
  it('defaults parent_id to null for a character with no parent', async () => {
    const row = await db
      .insertInto('character')
      .values({ id: 'c1', name: 'Alice', aliases_json: '[]', created_at: 1 })
      .returningAll()
      .executeTakeFirstOrThrow()

    expect(row.parent_id).toBeNull()
  })

  it('stores and round-trips a parent_id referencing another character', async () => {
    await db
      .insertInto('character')
      .values({ id: 'parent', name: 'Elizabeth Bathory', aliases_json: '[]', created_at: 1 })
      .execute()

    const child = await db
      .insertInto('character')
      .values({
        id: 'child',
        name: 'Elizabeth Bathory (Brave)',
        aliases_json: '[]',
        created_at: 2,
        parent_id: 'parent'
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    expect(child.parent_id).toBe('parent')
  })

  it('sets parent_id to null when the parent character is deleted', async () => {
    await db
      .insertInto('character')
      .values({ id: 'parent', name: 'Elizabeth Bathory', aliases_json: '[]', created_at: 1 })
      .execute()
    await db
      .insertInto('character')
      .values({
        id: 'child',
        name: 'Elizabeth Bathory (Brave)',
        aliases_json: '[]',
        created_at: 2,
        parent_id: 'parent'
      })
      .execute()

    await db.deleteFrom('character').where('id', '=', 'parent').execute()

    const child = await db
      .selectFrom('character')
      .selectAll()
      .where('id', '=', 'child')
      .executeTakeFirstOrThrow()
    expect(child.parent_id).toBeNull()
  })
})
