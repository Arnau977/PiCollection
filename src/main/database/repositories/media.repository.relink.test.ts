import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createTestDb } from '../testHelpers'
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

function insertMedia(route: string): Promise<{ id: string }> {
  return mediaRepo.insertMediaRow(db, {
    id: randomUUID(),
    name: 'pic',
    sfw: 1,
    is_ai_generated: 0,
    type: 'image',
    route,
    alias: null,
    artist_id: null,
    created_at: Date.now(),
    hash: null,
    phash: null
  })
}

describe('listMediaRoutes', () => {
  it('returns the id and route of every media row', async () => {
    const a = await insertMedia('C:\\Old\\a.png')
    const b = await insertMedia('C:\\Old\\b.png')

    const routes = await mediaRepo.listMediaRoutes(db)

    expect(routes.sort((x, y) => x.route.localeCompare(y.route))).toEqual([
      { id: a.id, route: 'C:\\Old\\a.png' },
      { id: b.id, route: 'C:\\Old\\b.png' }
    ])
  })
})

describe('updateMediaRoutes', () => {
  it('applies every route update in one transaction', async () => {
    const a = await insertMedia('C:\\Old\\a.png')
    const b = await insertMedia('C:\\Old\\b.png')
    const untouched = await insertMedia('C:\\Keep\\c.png')

    await mediaRepo.updateMediaRoutes(db, [
      { id: a.id, route: 'D:\\New\\a.png' },
      { id: b.id, route: 'D:\\New\\b.png' }
    ])

    const routes = await mediaRepo.listMediaRoutes(db)
    const byId = new Map(routes.map((row) => [row.id, row.route]))
    expect(byId.get(a.id)).toBe('D:\\New\\a.png')
    expect(byId.get(b.id)).toBe('D:\\New\\b.png')
    expect(byId.get(untouched.id)).toBe('C:\\Keep\\c.png')
  })
})
