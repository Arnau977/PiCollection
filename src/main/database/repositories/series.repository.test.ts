import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createTestDb } from '../testHelpers'
import * as seriesRepo from './series.repository'
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

describe('findSeriesHierarchy', () => {
  it('returns the id/parentId pair for every series', async () => {
    await seriesRepo.insertSeries(db, {
      id: 'parent',
      name: 'Parent',
      aliases_json: '[]',
      created_at: 1,
      parent_id: null
    })
    await seriesRepo.insertSeries(db, {
      id: 'child',
      name: 'Child',
      aliases_json: '[]',
      created_at: 2,
      parent_id: 'parent'
    })

    const hierarchy = await seriesRepo.findSeriesHierarchy(db)

    expect(hierarchy.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: 'child', parentId: 'parent' },
      { id: 'parent', parentId: null }
    ])
  })
})

describe('countMediaPerSeries', () => {
  it('counts direct media links per series, defaulting to 0 for series with none', async () => {
    await seriesRepo.insertSeries(db, {
      id: 'tagged',
      name: 'Tagged',
      aliases_json: '[]',
      created_at: 1,
      parent_id: null
    })
    await seriesRepo.insertSeries(db, {
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
      phash: null,
      pending_tagging: 0
    })
    await mediaRepo.setMediaSeries(db, media.id, ['tagged'])

    const counts = await seriesRepo.countMediaPerSeries(db)

    expect(counts).toEqual({ tagged: 1, untagged: 0 })
  })
})
