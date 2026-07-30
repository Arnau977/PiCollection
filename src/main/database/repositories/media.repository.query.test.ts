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

function insertMedia(name: string, artistId: string | null = null): Promise<{ id: string }> {
  return mediaRepo.insertMediaRow(db, {
    id: randomUUID(),
    name,
    sfw: 1,
    is_ai_generated: 0,
    type: 'image',
    route: `/${name}.png`,
    alias: null,
    artist_id: artistId,
    created_at: Date.now()
  })
}

function insertTag(name: string): Promise<{ id: string }> {
  return tagRepo.insertTag(db, { id: randomUUID(), name })
}

function insertCharacter(name: string): Promise<{ id: string }> {
  return characterRepo.insertCharacter(db, {
    id: randomUUID(),
    name,
    aliases_json: '[]',
    created_at: Date.now()
  })
}

async function names(query: string): Promise<string[]> {
  const rows = await mediaRepo.findMediaRows(db, { query }, { prop: 'name' })
  return rows.map((row) => row.name)
}

describe('media.repository free-text query', () => {
  it('matches a term against a tag name', async () => {
    const tag = await insertTag('landscape')
    const tagged = await insertMedia('tagged')
    await insertMedia('untagged')
    await mediaRepo.setMediaTags(db, tagged.id, [tag.id])

    expect(await names('landscape')).toEqual(['tagged'])
  })

  it('matches a term against the media name itself', async () => {
    await insertMedia('sunset')
    await insertMedia('sunrise')

    expect(await names('sunset')).toEqual(['sunset'])
  })

  it('matches a term against a character name', async () => {
    const character = await insertCharacter('Ishtar')
    const withCharacter = await insertMedia('withCharacter')
    await insertMedia('plain')
    await mediaRepo.setMediaCharacters(db, withCharacter.id, [character.id])

    expect(await names('Ishtar')).toEqual(['withCharacter'])
  })

  it('matches a term against a series name', async () => {
    const series = await seriesRepo.insertSeries(db, {
      id: randomUUID(),
      name: 'Wonderland',
      aliases_json: '[]',
      created_at: Date.now()
    })
    const withSeries = await insertMedia('withSeries')
    await insertMedia('plain')
    await mediaRepo.setMediaSeries(db, withSeries.id, [series.id])

    expect(await names('Wonderland')).toEqual(['withSeries'])
  })

  it('matches a term against an artist name', async () => {
    const artist = await artistRepo.insertArtist(db, {
      id: randomUUID(),
      name: 'Jane Doe',
      created_at: Date.now()
    })
    await insertMedia('byJane', artist.id)
    await insertMedia('anonymous')

    expect(await names('Jane')).toEqual(['byJane'])
  })

  it('treats a space as AND', async () => {
    const tagA = await insertTag('tagA')
    const tagB = await insertTag('tagB')
    const both = await insertMedia('both')
    const onlyA = await insertMedia('onlyA')
    await mediaRepo.setMediaTags(db, both.id, [tagA.id, tagB.id])
    await mediaRepo.setMediaTags(db, onlyA.id, [tagA.id])

    expect(await names('tagA tagB')).toEqual(['both'])
  })

  it('treats OR as a union', async () => {
    const tagA = await insertTag('tagA')
    const tagB = await insertTag('tagB')
    const a = await insertMedia('a')
    const b = await insertMedia('b')
    await insertMedia('neither')
    await mediaRepo.setMediaTags(db, a.id, [tagA.id])
    await mediaRepo.setMediaTags(db, b.id, [tagB.id])

    expect(await names('tagA OR tagB')).toEqual(['a', 'b'])
  })

  it('excludes media matching a negated term', async () => {
    const tagA = await insertTag('fujimaru')
    const excluded = await insertMedia('excluded')
    await insertMedia('kept')
    await mediaRepo.setMediaTags(db, excluded.id, [tagA.id])

    expect(await names('-Fujimaru')).toEqual(['kept'])
  })

  it('keeps artist-less media when using a negated term', async () => {
    // Guards the NULL-handling around the artist_id subquery: without it,
    // negation would wrongly drop every media that has no artist.
    const tag = await insertTag('unwanted')
    const tagged = await insertMedia('tagged')
    await insertMedia('noArtistNoTag')
    await mediaRepo.setMediaTags(db, tagged.id, [tag.id])

    expect(await names('-unwanted')).toEqual(['noArtistNoTag'])
  })

  it('supports the documented grouped example', async () => {
    const zibai = await insertTag('Zibai')
    const suit = await insertTag('suit')
    const other = await insertTag('other')

    const wanted = await insertMedia('wanted')
    const wantedButSuited = await insertMedia('wantedButSuited')
    const unrelated = await insertMedia('unrelated')

    await mediaRepo.setMediaTags(db, wanted.id, [zibai.id])
    await mediaRepo.setMediaTags(db, wantedButSuited.id, [zibai.id, suit.id])
    await mediaRepo.setMediaTags(db, unrelated.id, [other.id])

    expect(await names('(Zibai OR 兹白) (-suit)')).toEqual(['wanted'])
  })

  it('gives AND precedence over OR', async () => {
    const tagA = await insertTag('tagA')
    const tagB = await insertTag('tagB')
    const tagC = await insertTag('tagC')

    const justA = await insertMedia('justA')
    const bAndC = await insertMedia('bAndC')
    const justB = await insertMedia('justB')

    await mediaRepo.setMediaTags(db, justA.id, [tagA.id])
    await mediaRepo.setMediaTags(db, bAndC.id, [tagB.id, tagC.id])
    await mediaRepo.setMediaTags(db, justB.id, [tagB.id])

    // tagA OR (tagB AND tagC)
    expect(await names('tagA OR tagB tagC')).toEqual(['bAndC', 'justA'])
  })

  it('lets parentheses override precedence', async () => {
    const tagA = await insertTag('tagA')
    const tagB = await insertTag('tagB')
    const tagC = await insertTag('tagC')

    const aAndC = await insertMedia('aAndC')
    const bAndC = await insertMedia('bAndC')
    const justA = await insertMedia('justA')
    const justC = await insertMedia('justC')

    await mediaRepo.setMediaTags(db, aAndC.id, [tagA.id, tagC.id])
    await mediaRepo.setMediaTags(db, bAndC.id, [tagB.id, tagC.id])
    await mediaRepo.setMediaTags(db, justA.id, [tagA.id])
    await mediaRepo.setMediaTags(db, justC.id, [tagC.id])

    // (tagA OR tagB) AND tagC
    expect(await names('(tagA OR tagB) tagC')).toEqual(['aAndC', 'bAndC'])
  })

  it('combines the query with other filters using AND', async () => {
    const tag = await insertTag('shared')
    const image = await insertMedia('image')
    await mediaRepo.setMediaTags(db, image.id, [tag.id])

    const video = await mediaRepo.insertMediaRow(db, {
      id: randomUUID(),
      name: 'video',
      sfw: 1,
      is_ai_generated: 0,
      type: 'video',
      route: '/v.mp4',
      alias: null,
      artist_id: null,
      created_at: Date.now()
    })
    await mediaRepo.setMediaTags(db, video.id, [tag.id])

    const rows = await mediaRepo.findMediaRows(db, { query: 'shared', type: 'video' })
    expect(rows.map((r) => r.name)).toEqual(['video'])
  })

  it('returns everything when the query has no usable terms', async () => {
    await insertMedia('a')
    await insertMedia('b')

    expect(await names('   ')).toEqual(['a', 'b'])
    expect(await names('()')).toEqual(['a', 'b'])
  })

  it('counts matches for a query the same way it lists them', async () => {
    const tag = await insertTag('landscape')
    const tagged = await insertMedia('tagged')
    await insertMedia('untagged')
    await mediaRepo.setMediaTags(db, tagged.id, [tag.id])

    expect(await mediaRepo.countMediaRows(db, { query: 'landscape' })).toBe(1)
    expect(await mediaRepo.countMediaRows(db, { query: '-landscape' })).toBe(1)
  })
})
