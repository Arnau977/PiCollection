import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createTestDb } from '../testHelpers'
import * as mediaRepo from './media.repository'
import * as tagRepo from './tag.repository'
import * as characterRepo from './character.repository'
import * as seriesRepo from './series.repository'
import * as artistRepo from './artist.repository'
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

function insertMedia(name: string): ReturnType<typeof mediaRepo.insertMediaRow> {
  return mediaRepo.insertMediaRow(db, {
    id: randomUUID(),
    name,
    sfw: 1,
    is_ai_generated: 0,
    type: 'image',
    route: `/${name}.png`,
    alias: null,
    artist_id: null,
    created_at: Date.now(),
    hash: null,
    phash: null
  })
}

function baseMediaRow(
  overrides: Partial<Parameters<typeof mediaRepo.insertMediaRow>[1]> = {}
): ReturnType<typeof mediaRepo.insertMediaRow> {
  return mediaRepo.insertMediaRow(db, {
    id: randomUUID(),
    name: 'm',
    sfw: 1,
    is_ai_generated: 0,
    type: 'image',
    route: '/m.png',
    alias: null,
    artist_id: null,
    created_at: Date.now(),
    hash: null,
    phash: null,
    ...overrides
  })
}

describe('media.repository tag/character grouped AND/OR filtering', () => {
  it('OR (two singleton groups) returns media matching at least one of the given tags', async () => {
    const tagA = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'tagA',
      created_at: Date.now()
    })
    const tagB = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'tagB',
      created_at: Date.now()
    })
    const onlyA = await insertMedia('onlyA')
    const ab = await insertMedia('ab')
    const none = await insertMedia('none')

    await mediaRepo.setMediaTags(db, onlyA.id, [tagA.id])
    await mediaRepo.setMediaTags(db, ab.id, [tagA.id, tagB.id])
    await mediaRepo.setMediaTags(db, none.id, [])

    const result = await mediaRepo.findMediaRows(db, {
      tagGroups: [[tagA.id], [tagB.id]]
    })

    expect(result.map((r) => r.name).sort()).toEqual(['ab', 'onlyA'])
  })

  it('AND (single group) returns only media matching every given tag', async () => {
    const tagA = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'tagA',
      created_at: Date.now()
    })
    const tagB = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'tagB',
      created_at: Date.now()
    })
    const onlyA = await insertMedia('onlyA')
    const ab = await insertMedia('ab')

    await mediaRepo.setMediaTags(db, onlyA.id, [tagA.id])
    await mediaRepo.setMediaTags(db, ab.id, [tagA.id, tagB.id])

    const result = await mediaRepo.findMediaRows(db, {
      tagGroups: [[tagA.id, tagB.id]]
    })

    expect(result.map((r) => r.name)).toEqual(['ab'])
  })

  it('AND (single group) returns nothing when no single media has every requested tag', async () => {
    const tagA = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'tagA',
      created_at: Date.now()
    })
    const tagC = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'tagC',
      created_at: Date.now()
    })
    const onlyA = await insertMedia('onlyA')
    await mediaRepo.setMediaTags(db, onlyA.id, [tagA.id])

    const result = await mediaRepo.findMediaRows(db, {
      tagGroups: [[tagA.id, tagC.id]]
    })

    expect(result).toEqual([])
  })

  it('OR-of-AND-groups: matches media satisfying any one full group', async () => {
    const ishtar = await characterRepo.insertCharacter(db, {
      id: randomUUID(),
      name: 'Ishtar',
      aliases_json: '[]',
      created_at: Date.now()
    })
    const ereshkigal = await characterRepo.insertCharacter(db, {
      id: randomUUID(),
      name: 'Ereshkigal',
      aliases_json: '[]',
      created_at: Date.now()
    })
    const rin = await characterRepo.insertCharacter(db, {
      id: randomUUID(),
      name: 'Rin',
      aliases_json: '[]',
      created_at: Date.now()
    })
    const shirou = await characterRepo.insertCharacter(db, {
      id: randomUUID(),
      name: 'Shirou',
      aliases_json: '[]',
      created_at: Date.now()
    })

    const bothMesopotamian = await insertMedia('bothMesopotamian')
    const bothFate = await insertMedia('bothFate')
    const onlyIshtar = await insertMedia('onlyIshtar')
    const mixedPair = await insertMedia('mixedPair')

    await mediaRepo.setMediaCharacters(db, bothMesopotamian.id, [ishtar.id, ereshkigal.id])
    await mediaRepo.setMediaCharacters(db, bothFate.id, [rin.id, shirou.id])
    await mediaRepo.setMediaCharacters(db, onlyIshtar.id, [ishtar.id])
    await mediaRepo.setMediaCharacters(db, mixedPair.id, [ishtar.id, shirou.id])

    const result = await mediaRepo.findMediaRows(db, {
      characterGroups: [
        [ishtar.id, ereshkigal.id],
        [rin.id, shirou.id]
      ]
    })

    expect(result.map((r) => r.name).sort()).toEqual(['bothFate', 'bothMesopotamian'])
  })

  it('tags and characters filters combine with AND at the top level, independently of their own groups', async () => {
    const tagA = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'tagA',
      created_at: Date.now()
    })
    const tagB = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'tagB',
      created_at: Date.now()
    })
    const charX = await characterRepo.insertCharacter(db, {
      id: randomUUID(),
      name: 'charX',
      aliases_json: '[]',
      created_at: Date.now()
    })

    const matches = await insertMedia('matches')
    const wrongCharacter = await insertMedia('wrongCharacter')

    // `matches` has both tags (AND) and the character -> should be returned
    await mediaRepo.setMediaTags(db, matches.id, [tagA.id, tagB.id])
    await mediaRepo.setMediaCharacters(db, matches.id, [charX.id])

    // `wrongCharacter` has both tags but not the character -> should be excluded
    await mediaRepo.setMediaTags(db, wrongCharacter.id, [tagA.id, tagB.id])

    const result = await mediaRepo.findMediaRows(db, {
      tagGroups: [[tagA.id, tagB.id]],
      characterGroups: [[charX.id]]
    })

    expect(result.map((r) => r.name)).toEqual(['matches'])
  })

  it('ignores empty groups when computing the OR-of-AND filter', async () => {
    const tagA = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'tagA',
      created_at: Date.now()
    })
    const onlyA = await insertMedia('onlyA')
    await insertMedia('none')
    await mediaRepo.setMediaTags(db, onlyA.id, [tagA.id])

    const result = await mediaRepo.findMediaRows(db, {
      tagGroups: [[], [tagA.id], []]
    })

    expect(result.map((r) => r.name)).toEqual(['onlyA'])
  })

  it('OR returns media matching at least one of the given series', async () => {
    const seriesA = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'seriesA',
      aliases_json: '[]',
      created_at: Date.now(),
      parent_id: null
    })
    const seriesB = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'seriesB',
      aliases_json: '[]',
      created_at: Date.now(),
      parent_id: null
    })
    const onlyA = await insertMedia('onlyA')
    const ab = await insertMedia('ab')
    const none = await insertMedia('none')

    await mediaRepo.setMediaSeries(db, onlyA.id, [seriesA.id])
    await mediaRepo.setMediaSeries(db, ab.id, [seriesA.id, seriesB.id])
    await mediaRepo.setMediaSeries(db, none.id, [])

    const result = await mediaRepo.findMediaRows(db, {
      seriesGroups: [[seriesA.id], [seriesB.id]]
    })

    expect(result.map((r) => r.name).sort()).toEqual(['ab', 'onlyA'])
  })

  it('AND returns only media matching every given series', async () => {
    const seriesA = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'seriesA',
      aliases_json: '[]',
      created_at: Date.now(),
      parent_id: null
    })
    const seriesB = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'seriesB',
      aliases_json: '[]',
      created_at: Date.now(),
      parent_id: null
    })
    const onlyA = await insertMedia('onlyA')
    const ab = await insertMedia('ab')

    await mediaRepo.setMediaSeries(db, onlyA.id, [seriesA.id])
    await mediaRepo.setMediaSeries(db, ab.id, [seriesA.id, seriesB.id])

    const result = await mediaRepo.findMediaRows(db, {
      seriesGroups: [[seriesA.id, seriesB.id]]
    })

    expect(result.map((r) => r.name)).toEqual(['ab'])
  })
})

describe('media.repository series hierarchy filtering (seriesClosures)', () => {
  it('expands a parent series filter to also match media tagged only with a descendant', async () => {
    const parent = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'parent',
      aliases_json: '[]',
      created_at: Date.now(),
      parent_id: null
    })
    const child = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'child',
      aliases_json: '[]',
      created_at: Date.now(),
      parent_id: parent.id
    })
    const onlyChild = await insertMedia('onlyChild')
    await insertMedia('unrelated')
    await mediaRepo.setMediaSeries(db, onlyChild.id, [child.id])

    const seriesClosures = new Map([[parent.id, [parent.id, child.id]]])
    const result = await mediaRepo.findMediaRows(
      db,
      { seriesGroups: [[parent.id]] },
      undefined,
      seriesClosures
    )

    expect(result.map((r) => r.name)).toEqual(['onlyChild'])
  })

  it('AND requires a match within each selected series own closure, not just any two matching ids', async () => {
    const parentA = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'parentA',
      aliases_json: '[]',
      created_at: Date.now(),
      parent_id: null
    })
    const childA1 = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'childA1',
      aliases_json: '[]',
      created_at: Date.now(),
      parent_id: parentA.id
    })
    const childA2 = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'childA2',
      aliases_json: '[]',
      created_at: Date.now(),
      parent_id: parentA.id
    })
    const parentB = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'parentB',
      aliases_json: '[]',
      created_at: Date.now(),
      parent_id: null
    })
    const childB1 = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'childB1',
      aliases_json: '[]',
      created_at: Date.now(),
      parent_id: parentB.id
    })

    const matchesBoth = await insertMedia('matchesBoth')
    const onlyUnderA = await insertMedia('onlyUnderA')
    await mediaRepo.setMediaSeries(db, matchesBoth.id, [childA1.id, childB1.id])
    await mediaRepo.setMediaSeries(db, onlyUnderA.id, [childA1.id, childA2.id])

    const seriesClosures = new Map([
      [parentA.id, [parentA.id, childA1.id, childA2.id]],
      [parentB.id, [parentB.id, childB1.id]]
    ])
    const result = await mediaRepo.findMediaRows(
      db,
      { seriesGroups: [[parentA.id, parentB.id]] },
      undefined,
      seriesClosures
    )

    expect(result.map((r) => r.name)).toEqual(['matchesBoth'])
  })
})

describe('media.repository free-text/sfw/type filtering', () => {
  it('filters by free-text query, sfw and type', async () => {
    await mediaRepo.insertMediaRow(db, {
      id: randomUUID(),
      name: 'Sunset picture',
      sfw: 1,
      is_ai_generated: 0,
      type: 'image',
      route: '/a.png',
      alias: null,
      artist_id: null,
      created_at: Date.now(),
      hash: null,
      phash: null
    })
    await mediaRepo.insertMediaRow(db, {
      id: randomUUID(),
      name: 'Sunset video',
      sfw: 0,
      is_ai_generated: 0,
      type: 'video',
      route: '/b.mp4',
      alias: null,
      artist_id: null,
      created_at: Date.now(),
      hash: null,
      phash: null
    })

    const byName = await mediaRepo.findMediaRows(db, { query: 'sunset' })
    expect(byName).toHaveLength(2)

    const bySfw = await mediaRepo.findMediaRows(db, { sfw: true })
    expect(bySfw.map((r) => r.name)).toEqual(['Sunset picture'])

    const byType = await mediaRepo.findMediaRows(db, { type: 'video' })
    expect(byType.map((r) => r.name)).toEqual(['Sunset video'])
  })

  it('sorts by the requested column and direction', async () => {
    await insertMedia('bbb')
    await insertMedia('aaa')
    await insertMedia('ccc')

    const asc = await mediaRepo.findMediaRows(db, {}, { prop: 'name', desc: false })
    expect(asc.map((r) => r.name)).toEqual(['aaa', 'bbb', 'ccc'])

    const desc = await mediaRepo.findMediaRows(db, {}, { prop: 'name', desc: true })
    expect(desc.map((r) => r.name)).toEqual(['ccc', 'bbb', 'aaa'])
  })

  it('respects limit and offset for pagination', async () => {
    await insertMedia('a')
    await insertMedia('b')
    await insertMedia('c')

    const page1 = await mediaRepo.findMediaRows(db, { limit: 2, offset: 0 }, { prop: 'name' })
    const page2 = await mediaRepo.findMediaRows(db, { limit: 2, offset: 2 }, { prop: 'name' })

    expect(page1.map((r) => r.name)).toEqual(['a', 'b'])
    expect(page2.map((r) => r.name)).toEqual(['c'])
  })

  it('countMediaRows reports the total number of matches regardless of limit/offset', async () => {
    await insertMedia('a')
    await insertMedia('b')
    await insertMedia('c')

    const totalUnfiltered = await mediaRepo.countMediaRows(db, { limit: 1 })
    expect(totalUnfiltered).toBe(3)

    const tagA = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'tagA',
      created_at: Date.now()
    })
    const onlyOne = await insertMedia('onlyOne')
    await mediaRepo.setMediaTags(db, onlyOne.id, [tagA.id])

    const totalFiltered = await mediaRepo.countMediaRows(db, { tagGroups: [[tagA.id]] })
    expect(totalFiltered).toBe(1)
  })
})

describe('routesExist', () => {
  it('returns an empty set for an empty input array', async () => {
    expect(await mediaRepo.routesExist(db, [])).toEqual(new Set())
  })

  it('returns only the routes that exist among those queried', async () => {
    await insertMedia('cat')
    await insertMedia('dog')

    const result = await mediaRepo.routesExist(db, ['/cat.png', '/dog.png', '/missing.png'])

    expect(result).toEqual(new Set(['/cat.png', '/dog.png']))
  })

  it('chunks large candidate lists so it does not throw "too many SQL variables"', async () => {
    await insertMedia('cat')
    await insertMedia('dog')

    const candidates = Array.from({ length: 600 }, (_, i) => `/missing-${i}.png`)
    candidates.push('/cat.png', '/dog.png')

    const result = await mediaRepo.routesExist(db, candidates)

    expect(result).toEqual(new Set(['/cat.png', '/dog.png']))
  })
})

describe('findEntityThumbnails', () => {
  it('returns one thumbnail per tag id, ignoring NSFW media', async () => {
    const tagA = await tagRepo.insertTag(db, { id: 'ta', name: 'a', created_at: 1 })
    const tagB = await tagRepo.insertTag(db, { id: 'tb', name: 'b', created_at: 1 })
    const sfwMedia = await baseMediaRow({ id: 'm1', sfw: 1 })
    const nsfwMedia = await baseMediaRow({ id: 'm2', route: '/m2', sfw: 0 })
    await mediaRepo.setMediaTags(db, sfwMedia.id, [tagA.id])
    await mediaRepo.setMediaTags(db, nsfwMedia.id, [tagB.id])

    const result = await mediaRepo.findEntityThumbnails(db, 'tag', [tagA.id, tagB.id])

    expect(result).toEqual([{ entityId: tagA.id, route: sfwMedia.route, type: sfwMedia.type }])
  })

  it('returns nothing for an empty id list without querying', async () => {
    expect(await mediaRepo.findEntityThumbnails(db, 'artist', [])).toEqual([])
  })

  it('prefers a media item where the character appears alone', async () => {
    const solo = await characterRepo.insertCharacter(db, {
      id: 'c1',
      name: 'Solo',
      aliases_json: '[]',
      created_at: 1
    })
    const other = await characterRepo.insertCharacter(db, {
      id: 'c2',
      name: 'Other',
      aliases_json: '[]',
      created_at: 1
    })
    const groupMedia = await baseMediaRow({ id: 'm1', route: '/group', sfw: 1 })
    const soloMedia = await baseMediaRow({ id: 'm2', route: '/solo', sfw: 1 })
    await mediaRepo.setMediaCharacters(db, groupMedia.id, [solo.id, other.id])
    await mediaRepo.setMediaCharacters(db, soloMedia.id, [solo.id])

    const result = await mediaRepo.findEntityThumbnails(db, 'character', [solo.id])

    expect(result).toEqual([{ entityId: solo.id, route: '/solo', type: soloMedia.type }])
  })

  it('returns one thumbnail per artist id directly from media.artist_id', async () => {
    const artist = await artistRepo.insertArtist(db, { id: 'a1', name: 'Artist', created_at: 1 })
    const media = await baseMediaRow({ id: 'm1', sfw: 1, artist_id: artist.id })

    const result = await mediaRepo.findEntityThumbnails(db, 'artist', [artist.id])

    expect(result).toEqual([{ entityId: artist.id, route: media.route, type: media.type }])
  })

  it('omits an entity with no eligible SFW media entirely', async () => {
    const tag = await tagRepo.insertTag(db, { id: 't1', name: 'a', created_at: 1 })
    expect(await mediaRepo.findEntityThumbnails(db, 'tag', [tag.id])).toEqual([])
  })
})

describe('findSeriesThumbnailsByClosure', () => {
  /** parent -> child -> grandchild, plus an unrelated 'other' series. */
  async function insertSeriesTree(): Promise<void> {
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
      created_at: 1,
      parent_id: 'parent'
    })
    await seriesRepo.insertSeries(db, {
      id: 'grandchild',
      name: 'Grandchild',
      aliases_json: '[]',
      created_at: 1,
      parent_id: 'child'
    })
    await seriesRepo.insertSeries(db, {
      id: 'other',
      name: 'Other',
      aliases_json: '[]',
      created_at: 1,
      parent_id: null
    })
  }

  it('returns nothing for an empty pair list without querying', async () => {
    expect(await mediaRepo.findSeriesThumbnailsByClosure(db, [])).toEqual([])
  })

  it('gives a parent with no direct media a thumbnail from its child', async () => {
    await insertSeriesTree()
    const media = await baseMediaRow({ id: 'm1', route: '/child.png', sfw: 1 })
    await mediaRepo.setMediaSeries(db, media.id, ['child'])

    const result = await mediaRepo.findSeriesThumbnailsByClosure(db, [
      { descendantId: 'parent', ancestorId: 'parent' },
      { descendantId: 'child', ancestorId: 'parent' },
      { descendantId: 'grandchild', ancestorId: 'parent' }
    ])

    expect(result).toEqual([{ entityId: 'parent', route: '/child.png', type: media.type }])
  })

  it('reaches a grandchild two levels down', async () => {
    await insertSeriesTree()
    const media = await baseMediaRow({ id: 'm1', route: '/grandchild.png', sfw: 1 })
    await mediaRepo.setMediaSeries(db, media.id, ['grandchild'])

    const result = await mediaRepo.findSeriesThumbnailsByClosure(db, [
      { descendantId: 'parent', ancestorId: 'parent' },
      { descendantId: 'child', ancestorId: 'parent' },
      { descendantId: 'grandchild', ancestorId: 'parent' }
    ])

    expect(result).toEqual([{ entityId: 'parent', route: '/grandchild.png', type: media.type }])
  })

  it('omits a series whose whole closure has no media, without borrowing another series’ media', async () => {
    await insertSeriesTree()
    const media = await baseMediaRow({ id: 'm1', route: '/other.png', sfw: 1 })
    await mediaRepo.setMediaSeries(db, media.id, ['other'])

    const result = await mediaRepo.findSeriesThumbnailsByClosure(db, [
      { descendantId: 'parent', ancestorId: 'parent' },
      { descendantId: 'child', ancestorId: 'parent' },
      { descendantId: 'grandchild', ancestorId: 'parent' }
    ])

    expect(result).toEqual([])
  })

  it('still ignores NSFW media anywhere in the closure', async () => {
    await insertSeriesTree()
    const nsfw = await baseMediaRow({ id: 'm1', route: '/nsfw.png', sfw: 0 })
    await mediaRepo.setMediaSeries(db, nsfw.id, ['child'])

    const result = await mediaRepo.findSeriesThumbnailsByClosure(db, [
      { descendantId: 'parent', ancestorId: 'parent' },
      { descendantId: 'child', ancestorId: 'parent' }
    ])

    expect(result).toEqual([])
  })

  it('resolves several requested ancestors independently in one query', async () => {
    await insertSeriesTree()
    const childMedia = await baseMediaRow({ id: 'm1', route: '/child.png', sfw: 1 })
    const otherMedia = await baseMediaRow({ id: 'm2', route: '/other.png', sfw: 1 })
    await mediaRepo.setMediaSeries(db, childMedia.id, ['child'])
    await mediaRepo.setMediaSeries(db, otherMedia.id, ['other'])

    const result = await mediaRepo.findSeriesThumbnailsByClosure(db, [
      { descendantId: 'parent', ancestorId: 'parent' },
      { descendantId: 'child', ancestorId: 'parent' },
      { descendantId: 'grandchild', ancestorId: 'parent' },
      { descendantId: 'child', ancestorId: 'child' },
      { descendantId: 'grandchild', ancestorId: 'child' },
      { descendantId: 'other', ancestorId: 'other' }
    ])

    expect([...result].sort((a, b) => a.entityId.localeCompare(b.entityId))).toEqual([
      { entityId: 'child', route: '/child.png', type: childMedia.type },
      { entityId: 'other', route: '/other.png', type: otherMedia.type },
      { entityId: 'parent', route: '/child.png', type: childMedia.type }
    ])
  })
})
