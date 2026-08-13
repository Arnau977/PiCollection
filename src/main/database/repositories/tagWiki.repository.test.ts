import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createTestDb } from '../testHelpers'
import * as tagWikiRepo from './tagWiki.repository'
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

describe('tagWiki.repository', () => {
  it('returns undefined for a tag name with no cached entry', async () => {
    expect(await tagWikiRepo.findCachedTagWiki(db, 'nonexistent')).toBeUndefined()
  })

  it('upserts a row and finds it by tag_name', async () => {
    await tagWikiRepo.upsertTagWiki(db, {
      tag_name: 'cat_ears',
      body: 'A character with cat ears.',
      other_names_json: JSON.stringify(['nekomimi']),
      fetched_at: 1000
    })

    const found = await tagWikiRepo.findCachedTagWiki(db, 'cat_ears')

    expect(found).toEqual({
      tag_name: 'cat_ears',
      body: 'A character with cat ears.',
      other_names_json: JSON.stringify(['nekomimi']),
      fetched_at: 1000
    })
  })

  it('upserting the same tag_name again replaces the row instead of erroring', async () => {
    await tagWikiRepo.upsertTagWiki(db, {
      tag_name: 'cat_ears',
      body: 'old body',
      other_names_json: '[]',
      fetched_at: 1000
    })
    await tagWikiRepo.upsertTagWiki(db, {
      tag_name: 'cat_ears',
      body: 'new body',
      other_names_json: '[]',
      fetched_at: 2000
    })

    const found = await tagWikiRepo.findCachedTagWiki(db, 'cat_ears')

    expect(found?.body).toBe('new body')
    expect(found?.fetched_at).toBe(2000)
  })
})
