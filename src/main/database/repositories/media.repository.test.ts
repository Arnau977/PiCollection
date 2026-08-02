import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createTestDb } from '../testHelpers'
import * as mediaRepo from './media.repository'
import * as tagRepo from './tag.repository'
import * as characterRepo from './character.repository'
import * as seriesRepo from './series.repository'
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

describe('media.repository tag/character grouped AND/OR filtering', () => {
  it('OR (two singleton groups) returns media matching at least one of the given tags', async () => {
    const tagA = await tagRepo.insertTag(db, { id: randomUUID(), name: 'tagA' })
    const tagB = await tagRepo.insertTag(db, { id: randomUUID(), name: 'tagB' })
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
    const tagA = await tagRepo.insertTag(db, { id: randomUUID(), name: 'tagA' })
    const tagB = await tagRepo.insertTag(db, { id: randomUUID(), name: 'tagB' })
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
    const tagA = await tagRepo.insertTag(db, { id: randomUUID(), name: 'tagA' })
    const tagC = await tagRepo.insertTag(db, { id: randomUUID(), name: 'tagC' })
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
    const tagA = await tagRepo.insertTag(db, { id: randomUUID(), name: 'tagA' })
    const tagB = await tagRepo.insertTag(db, { id: randomUUID(), name: 'tagB' })
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
    const tagA = await tagRepo.insertTag(db, { id: randomUUID(), name: 'tagA' })
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
      created_at: Date.now()
    })
    const seriesB = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'seriesB',
      aliases_json: '[]',
      created_at: Date.now()
    })
    const onlyA = await insertMedia('onlyA')
    const ab = await insertMedia('ab')
    const none = await insertMedia('none')

    await mediaRepo.setMediaSeries(db, onlyA.id, [seriesA.id])
    await mediaRepo.setMediaSeries(db, ab.id, [seriesA.id, seriesB.id])
    await mediaRepo.setMediaSeries(db, none.id, [])

    const result = await mediaRepo.findMediaRows(db, {
      seriesIds: [seriesA.id, seriesB.id],
      seriesOperator: 'OR'
    })

    expect(result.map((r) => r.name).sort()).toEqual(['ab', 'onlyA'])
  })

  it('AND returns only media matching every given series', async () => {
    const seriesA = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'seriesA',
      aliases_json: '[]',
      created_at: Date.now()
    })
    const seriesB = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'seriesB',
      aliases_json: '[]',
      created_at: Date.now()
    })
    const onlyA = await insertMedia('onlyA')
    const ab = await insertMedia('ab')

    await mediaRepo.setMediaSeries(db, onlyA.id, [seriesA.id])
    await mediaRepo.setMediaSeries(db, ab.id, [seriesA.id, seriesB.id])

    const result = await mediaRepo.findMediaRows(db, {
      seriesIds: [seriesA.id, seriesB.id],
      seriesOperator: 'AND'
    })

    expect(result.map((r) => r.name)).toEqual(['ab'])
  })

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

    const tagA = await tagRepo.insertTag(db, { id: randomUUID(), name: 'tagA' })
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
})
