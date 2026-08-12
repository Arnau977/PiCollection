import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createTestDb } from '../testHelpers'
import * as artistRepo from './artist.repository'
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

describe('countMediaPerArtist', () => {
  it('counts media linked per artist, defaulting to 0 for artists with none', async () => {
    await artistRepo.insertArtist(db, { id: 'tagged', name: 'Tagged', created_at: 1 })
    await artistRepo.insertArtist(db, { id: 'untagged', name: 'Untagged', created_at: 2 })
    await mediaRepo.insertMediaRow(db, {
      id: randomUUID(),
      name: 'media',
      sfw: 1,
      is_ai_generated: 0,
      type: 'image',
      route: '/media.png',
      alias: null,
      artist_id: 'tagged',
      created_at: Date.now(),
      hash: null,
      phash: null,
      pending_tagging: 0
    })

    const counts = await artistRepo.countMediaPerArtist(db)

    expect(counts).toEqual({ tagged: 1, untagged: 0 })
  })
})
