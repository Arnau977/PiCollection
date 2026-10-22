import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createTestDb } from '../testHelpers'
import * as autoTagRepo from './autoTag.repository'
import * as mediaRepo from './media.repository'
import * as tagRepo from './tag.repository'
import * as statsRepo from './stats.repository'
import type { DB } from '../schema'

let db: Kysely<DB>
let cleanup: () => Promise<void>

async function addMedia(
  id: string,
  size: { width: number | null; height: number | null; hasAlpha?: boolean }
): Promise<void> {
  await mediaRepo.insertMediaRow(db, {
    id,
    name: id,
    sfw: 1,
    is_ai_generated: 0,
    type: 'image',
    route: `/${id}.png`,
    alias: null,
    artist_id: null,
    created_at: Date.now(),
    hash: null,
    phash: null,
    pending_tagging: 0,
    width: size.width,
    height: size.height,
    has_alpha: size.hasAlpha === undefined ? null : size.hasAlpha ? 1 : 0
  })
}

async function idsWithTag(tagId: string): Promise<string[]> {
  const rows = await mediaRepo.findMediaRows(db, { tagGroups: [[tagId]] })
  return rows.map((row) => row.id).sort()
}

beforeEach(async () => {
  const testDb = await createTestDb()
  db = testDb.db
  cleanup = testDb.cleanup
  await tagRepo.insertTag(db, {
    id: 'clear',
    name: 'Transparent',
    aliases_json: '[]',
    created_at: 1
  })
  await tagRepo.insertTag(db, { id: 'tall', name: 'Portrait', aliases_json: '[]', created_at: 1 })
  await addMedia('see-through', { width: 500, height: 900, hasAlpha: true })
  await addMedia('opaque', { width: 1200, height: 1200, hasAlpha: false })
  await addMedia('unread', { width: null, height: null })
})

afterEach(async () => {
  await cleanup()
})

describe('automatic tags', () => {
  it('filter, search, count and rank by a tag media only has through a rule', async () => {
    await autoTagRepo.setRule(db, 'transparent', 'clear')

    expect(await idsWithTag('clear')).toEqual(['see-through'])
    const searched = await mediaRepo.findMediaRows(db, { query: 'transparent' })
    expect(searched.map((row) => row.id)).toEqual(['see-through'])
    expect((await tagRepo.countMediaPerTag(db)).clear).toEqual({ library: 1, pending: 0 })
    expect(await statsRepo.topTagsByMediaCount(db, 5)).toEqual([
      { id: 'clear', name: 'Transparent', count: 1 }
    ])
    expect(await mediaRepo.findEntityThumbnails(db, 'tag', ['clear'])).toEqual([
      { entityId: 'clear', route: '/see-through.png', type: 'image' }
    ])

    const tags = await mediaRepo.findTagsForMediaIds(db, ['see-through'])
    expect(tags.get('see-through')).toEqual([expect.objectContaining({ id: 'clear', auto: true })])
  })

  it('counts a tag once when the media also has it by hand, and lists it as its own', async () => {
    await autoTagRepo.setRule(db, 'portrait', 'tall')
    await mediaRepo.setMediaTags(db, 'see-through', ['tall'])

    expect((await tagRepo.countMediaPerTag(db)).tall).toEqual({ library: 1, pending: 0 })
    const tags = await mediaRepo.findTagsForMediaIds(db, ['see-through'])
    expect(tags.get('see-through')).toEqual([expect.objectContaining({ id: 'tall', auto: false })])
  })

  it('stops matching once the rule is removed or its tag deleted', async () => {
    await autoTagRepo.setRule(db, 'transparent', 'clear')
    await autoTagRepo.deleteRule(db, 'transparent')
    expect(await idsWithTag('clear')).toEqual([])

    await autoTagRepo.setRule(db, 'portrait', 'tall')
    expect(await idsWithTag('tall')).toEqual(['see-through'])
    await tagRepo.deleteTag(db, 'tall')
    expect(await autoTagRepo.listRules(db)).toEqual([])
  })

  it('applies size rules only to analyzed pictures', async () => {
    await autoTagRepo.setRule(db, 'square', 'tall')
    expect(await idsWithTag('tall')).toEqual(['opaque'])
    expect(await autoTagRepo.countUnanalyzedMedia(db)).toBe(1)
  })
  it('follows Danbooru size rules, which stack', async () => {
    await addMedia('strip', { width: 300, height: 1300 })
    await addMedia('huge', { width: 3300, height: 900 })
    await autoTagRepo.setRule(db, 'highres', 'tall')
    await autoTagRepo.setRule(db, 'absurdres', 'clear')

    // 1200 tall reaches highres; 3300 wide is absurdres and highres.
    expect(await idsWithTag('tall')).toEqual(['huge', 'opaque', 'strip'])
    expect(await idsWithTag('clear')).toEqual(['huge'])

    await autoTagRepo.deleteRule(db, 'highres')
    await autoTagRepo.setRule(db, 'tall_image', 'tall')
    expect(await idsWithTag('tall')).toEqual(['strip'])
  })
})
