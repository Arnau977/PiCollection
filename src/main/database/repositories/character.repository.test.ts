import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createTestDb } from '../testHelpers'
import * as characterRepo from './character.repository'
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

describe('countMediaPerCharacter', () => {
  it('counts direct media links per character, defaulting to 0 for characters with none', async () => {
    await characterRepo.insertCharacter(db, {
      id: 'tagged',
      name: 'Tagged',
      aliases_json: '[]',
      created_at: 1,
      parent_id: null
    })
    await characterRepo.insertCharacter(db, {
      id: 'untagged',
      name: 'Untagged',
      aliases_json: '[]',
      created_at: 2,
      parent_id: null
    })
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
      phash: null
    })
    await mediaRepo.setMediaCharacters(db, media.id, ['tagged'])

    const counts = await characterRepo.countMediaPerCharacter(db)

    expect(counts).toEqual({ tagged: 1, untagged: 0 })
  })
})
