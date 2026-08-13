import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createTestDb } from '../testHelpers'
import * as tagRepo from './tag.repository'
import * as mediaRepo from './media.repository'
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

describe('countMediaPerTag', () => {
  it('counts direct media links per tag, defaulting to 0 for tags with none', async () => {
    await tagRepo.insertTag(db, { id: 'tagged', name: 'Tagged', aliases_json: '[]', created_at: 1 })
    await tagRepo.insertTag(db, { id: 'untagged', name: 'Untagged', aliases_json: '[]', created_at: 2 })
    const media = await mediaRepo.insertMediaRow(db, {
      id: randomUUID(),
      name: 'media',
      sfw: 1,
      is_ai_generated: 0,
      type: 'image',
      route: '/media.png',
      alias: null,
      artist_id: null,
      created_at: Date.now(),
      hash: null,
      phash: null,
      pending_tagging: 0
    })
    await mediaRepo.setMediaTags(db, media.id, ['tagged'])

    const counts = await tagRepo.countMediaPerTag(db)

    expect(counts).toEqual({ tagged: 1, untagged: 0 })
  })
})
