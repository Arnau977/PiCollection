import { vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '' }
}))

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'
import { mediaService } from './media.service'
import { tagService } from './tag.service'
import { characterService } from './character.service'
import { artistService } from './artist.service'
import { seriesService } from './series.service'
import type { MediaInput } from '@shared/models'

let cleanup: () => Promise<void>

beforeEach(async () => {
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
})

function baseInput(overrides: Partial<MediaInput> = {}): MediaInput {
  return {
    name: 'My media',
    type: 'image',
    route: '/some/path.png',
    sfw: true,
    isAiGenerated: false,
    ...overrides
  }
}

describe('mediaService.addMedia', () => {
  it('creates media and hydrates it with the associated tags, characters and artist', async () => {
    const artist = await artistService.createArtist({ name: 'Some Artist' })
    const tag = await tagService.createTag({ name: 'landscape' })
    const character = await characterService.createCharacter({ name: 'Hero' })

    const created = await mediaService.addMedia(
      baseInput({ artistId: artist.id, tagIds: [tag.id], characterIds: [character.id] })
    )

    expect(created.name).toBe('My media')
    expect(created.sfw).toBe(true)
    expect(created.isAiGenerated).toBe(false)
    expect(created.artist?.id).toBe(artist.id)
    expect(created.tags?.map((t) => t.id)).toEqual([tag.id])
    expect(created.characters?.map((c) => c.id)).toEqual([character.id])
    expect(typeof created.createdAt).toBe('number')
  })

  it('hydrates nested tag/character/series/artist models with their own createdAt', async () => {
    const artist = await artistService.createArtist({ name: 'Some Artist' })
    const tag = await tagService.createTag({ name: 'landscape' })
    const character = await characterService.createCharacter({ name: 'Hero' })
    const series = await seriesService.createSeries({ name: 'Some Series' })

    const created = await mediaService.addMedia(
      baseInput({
        artistId: artist.id,
        tagIds: [tag.id],
        characterIds: [character.id],
        seriesIds: [series.id]
      })
    )

    expect(created.artist?.createdAt).toBe(artist.createdAt)
    expect(created.tags?.[0]?.createdAt).toBe(tag.createdAt)
    expect(created.characters?.[0]?.createdAt).toBe(character.createdAt)
    expect(created.series?.[0]?.createdAt).toBe(series.createdAt)

    const fetched = await mediaService.getMediaById(created.id)
    expect(fetched?.artist?.createdAt).toBe(artist.createdAt)
    expect(fetched?.tags?.[0]?.createdAt).toBe(tag.createdAt)
    expect(fetched?.characters?.[0]?.createdAt).toBe(character.createdAt)
    expect(fetched?.series?.[0]?.createdAt).toBe(series.createdAt)
  })

  it('creates media linked to one or more series', async () => {
    const seriesA = await seriesService.createSeries({ name: 'Series A' })
    const seriesB = await seriesService.createSeries({ name: 'Series B' })

    const created = await mediaService.addMedia(baseInput({ seriesIds: [seriesA.id, seriesB.id] }))

    expect(created.series?.map((s) => s.id).sort()).toEqual([seriesA.id, seriesB.id].sort())
  })

  it('creates media flagged as AI-generated', async () => {
    const created = await mediaService.addMedia(baseInput({ isAiGenerated: true }))
    expect(created.isAiGenerated).toBe(true)
  })

  it('rejects media referencing a tag id that does not exist', async () => {
    await expect(mediaService.addMedia(baseInput({ tagIds: ['nonexistent-id'] }))).rejects.toThrow()
  })

  it('rejects media referencing a character id that does not exist', async () => {
    await expect(
      mediaService.addMedia(baseInput({ characterIds: ['nonexistent-id'] }))
    ).rejects.toThrow()
  })

  it('rejects media referencing an artist id that does not exist', async () => {
    await expect(mediaService.addMedia(baseInput({ artistId: 'nonexistent-id' }))).rejects.toThrow()
  })

  it('rejects media referencing a series id that does not exist', async () => {
    await expect(
      mediaService.addMedia(baseInput({ seriesIds: ['nonexistent-id'] }))
    ).rejects.toThrow()
  })

  it('does not create a media row when relation validation fails (transaction not started)', async () => {
    await expect(mediaService.addMedia(baseInput({ tagIds: ['nonexistent-id'] }))).rejects.toThrow()
    const all = await mediaService.getMediaFiltered({})
    expect(all.items).toHaveLength(0)
  })
})

describe('mediaService.getMediaById / updateMedia / deleteMedia', () => {
  it('returns null for an id that does not exist', async () => {
    const result = await mediaService.getMediaById('nonexistent-id')
    expect(result).toBeNull()
  })

  it('updates a media row and replaces its tags/characters/series', async () => {
    const tagA = await tagService.createTag({ name: 'a' })
    const tagB = await tagService.createTag({ name: 'b' })
    const seriesA = await seriesService.createSeries({ name: 'Series A' })
    const seriesB = await seriesService.createSeries({ name: 'Series B' })
    const created = await mediaService.addMedia(
      baseInput({ tagIds: [tagA.id], seriesIds: [seriesA.id] })
    )

    const updated = await mediaService.updateMedia(
      created.id,
      baseInput({
        name: 'Renamed',
        tagIds: [tagB.id],
        seriesIds: [seriesB.id],
        isAiGenerated: true
      })
    )

    expect(updated.name).toBe('Renamed')
    expect(updated.tags?.map((t) => t.id)).toEqual([tagB.id])
    expect(updated.series?.map((s) => s.id)).toEqual([seriesB.id])
    expect(updated.isAiGenerated).toBe(true)
  })

  it('deletes a media row', async () => {
    const created = await mediaService.addMedia(baseInput())
    await mediaService.deleteMedia(created.id)
    const result = await mediaService.getMediaById(created.id)
    expect(result).toBeNull()
  })
})

describe('mediaService.getMediaFiltered', () => {
  it('applies the AND/OR tag filter through the service layer', async () => {
    const tagA = await tagService.createTag({ name: 'a' })
    const tagB = await tagService.createTag({ name: 'b' })
    await mediaService.addMedia(
      baseInput({ name: 'onlyA', route: '/some/path-a.png', tagIds: [tagA.id] })
    )
    await mediaService.addMedia(
      baseInput({ name: 'both', route: '/some/path-b.png', tagIds: [tagA.id, tagB.id] })
    )

    const or = await mediaService.getMediaFiltered({
      tagGroups: [[tagA.id], [tagB.id]]
    })
    const and = await mediaService.getMediaFiltered({
      tagGroups: [[tagA.id, tagB.id]]
    })

    expect(or.items.map((m) => m.name).sort()).toEqual(['both', 'onlyA'])
    expect(and.items.map((m) => m.name)).toEqual(['both'])
  })

  it('applies the AND/OR series filter through the service layer', async () => {
    const seriesA = await seriesService.createSeries({ name: 'a' })
    const seriesB = await seriesService.createSeries({ name: 'b' })
    await mediaService.addMedia(
      baseInput({ name: 'onlyA', route: '/some/path-a.png', seriesIds: [seriesA.id] })
    )
    await mediaService.addMedia(
      baseInput({ name: 'both', route: '/some/path-b.png', seriesIds: [seriesA.id, seriesB.id] })
    )

    const or = await mediaService.getMediaFiltered({
      seriesGroups: [[seriesA.id], [seriesB.id]]
    })
    const and = await mediaService.getMediaFiltered({
      seriesGroups: [[seriesA.id, seriesB.id]]
    })

    expect(or.items.map((m) => m.name).sort()).toEqual(['both', 'onlyA'])
    expect(and.items.map((m) => m.name)).toEqual(['both'])
  })

  it('filtering by a parent series also surfaces media tagged only with a descendant series, and updates the count', async () => {
    const grandparent = await seriesService.createSeries({ name: 'Xenoblade Chronicles (series)' })
    const parent = await seriesService.createSeries({
      name: 'Xenoblade Chronicles 3',
      parentId: grandparent.id
    })
    const child = await seriesService.createSeries({
      name: 'Xenoblade Chronicles 3: Future Redeemed',
      parentId: parent.id
    })
    await mediaService.addMedia(
      baseInput({ name: 'onlyChild', route: '/some/path-a.png', seriesIds: [child.id] })
    )
    await mediaService.addMedia(baseInput({ name: 'unrelated', route: '/some/path-b.png' }))

    const byGrandparent = await mediaService.getMediaFiltered({ seriesGroups: [[grandparent.id]] })

    expect(byGrandparent.items.map((m) => m.name)).toEqual(['onlyChild'])
    expect(byGrandparent.total).toBe(1)
  })

  it('reports the total count of matching media independently of limit/offset', async () => {
    for (let i = 0; i < 5; i += 1) {
      await mediaService.addMedia(baseInput({ name: `media-${i}`, route: `/some/path-${i}.png` }))
    }

    const page = await mediaService.getMediaFiltered({ limit: 2, offset: 0 })

    expect(page.items).toHaveLength(2)
    expect(page.total).toBe(5)
  })
})

describe('mediaService.getEntityThumbnails', () => {
  it('delegates to the repository and returns its rows', async () => {
    const tag = await tagService.createTag({ name: 'a' })
    const media = await mediaService.addMedia(baseInput({ name: 'm', route: '/m.png' }))
    await mediaService.updateMedia(media.id, { ...baseInput({ name: 'm', route: '/m.png' }), tagIds: [tag.id] })

    const result = await mediaService.getEntityThumbnails('tag', [tag.id])

    expect(result).toEqual([{ entityId: tag.id, route: '/m.png', type: 'image' }])
  })
})
