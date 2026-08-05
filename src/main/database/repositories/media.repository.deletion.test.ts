import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Kysely } from 'kysely'
import { createTestDb } from '../testHelpers'
import * as mediaRepo from './media.repository'
import * as tagRepo from './tag.repository'
import * as characterRepo from './character.repository'
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

describe('foreign key delete behavior', () => {
  it('deleting an artist sets media.artist_id to null instead of deleting the media', async () => {
    const artist = await artistRepo.insertArtist(db, {
      id: randomUUID(),
      name: 'Jane',
      created_at: Date.now()
    })
    const media = await mediaRepo.insertMediaRow(db, {
      id: randomUUID(),
      name: 'pic',
      sfw: 1,
      is_ai_generated: 0,
      type: 'image',
      route: '/pic.png',
      alias: null,
      artist_id: artist.id,
      created_at: Date.now(),
      hash: null,
      phash: null
    })

    await artistRepo.deleteArtist(db, artist.id)

    const row = await mediaRepo.findMediaRowById(db, media.id)
    expect(row).not.toBeUndefined()
    expect(row?.artist_id).toBeNull()
  })

  it('deleting a tag removes it from media_tag but leaves the media row intact', async () => {
    const tag = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'landscape',
      created_at: Date.now()
    })
    const media = await mediaRepo.insertMediaRow(db, {
      id: randomUUID(),
      name: 'pic',
      sfw: 1,
      is_ai_generated: 0,
      type: 'image',
      route: '/pic.png',
      alias: null,
      artist_id: null,
      created_at: Date.now(),
      hash: null,
      phash: null
    })
    await mediaRepo.setMediaTags(db, media.id, [tag.id])

    await tagRepo.deleteTag(db, tag.id)

    const row = await mediaRepo.findMediaRowById(db, media.id)
    expect(row).not.toBeUndefined()
    const tagsByMedia = await mediaRepo.findTagsForMediaIds(db, [media.id])
    expect(tagsByMedia.get(media.id) ?? []).toEqual([])
  })

  it('deleting a character removes it from media_character but leaves the media row intact', async () => {
    const character = await characterRepo.insertCharacter(db, {
      id: randomUUID(),
      name: 'Hero',
      aliases_json: '[]',
      created_at: Date.now()
    })
    const media = await mediaRepo.insertMediaRow(db, {
      id: randomUUID(),
      name: 'pic',
      sfw: 1,
      is_ai_generated: 0,
      type: 'image',
      route: '/pic.png',
      alias: null,
      artist_id: null,
      created_at: Date.now(),
      hash: null,
      phash: null
    })
    await mediaRepo.setMediaCharacters(db, media.id, [character.id])

    await characterRepo.deleteCharacter(db, character.id)

    const row = await mediaRepo.findMediaRowById(db, media.id)
    expect(row).not.toBeUndefined()
    const charactersByMedia = await mediaRepo.findCharactersForMediaIds(db, [media.id])
    expect(charactersByMedia.get(media.id) ?? []).toEqual([])
  })

  it('deleting media removes its junction rows (media_tag/media_character)', async () => {
    const tag = await tagRepo.insertTag(db, {
      id: randomUUID(),
      name: 'landscape',
      created_at: Date.now()
    })
    const character = await characterRepo.insertCharacter(db, {
      id: randomUUID(),
      name: 'Hero',
      aliases_json: '[]',
      created_at: Date.now()
    })
    const media = await mediaRepo.insertMediaRow(db, {
      id: randomUUID(),
      name: 'pic',
      sfw: 1,
      is_ai_generated: 0,
      type: 'image',
      route: '/pic.png',
      alias: null,
      artist_id: null,
      created_at: Date.now(),
      hash: null,
      phash: null
    })
    await mediaRepo.setMediaTags(db, media.id, [tag.id])
    await mediaRepo.setMediaCharacters(db, media.id, [character.id])

    await mediaRepo.deleteMediaRow(db, media.id)

    // the tag/character themselves must survive - only the link rows should be gone
    const remainingTags = await tagRepo.findAllTags(db)
    const remainingCharacters = await characterRepo.findAllCharacters(db)
    expect(remainingTags.map((t) => t.id)).toEqual([tag.id])
    expect(remainingCharacters.map((c) => c.id)).toEqual([character.id])
  })
})
