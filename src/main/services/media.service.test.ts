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

describe('mediaService pendingTagging', () => {
  it('defaults pendingTagging to false when addMedia is not given one', async () => {
    const created = await mediaService.addMedia(baseInput())
    expect(created.pendingTagging).toBe(false)
  })

  it('respects pendingTagging: true passed to addMedia', async () => {
    const created = await mediaService.addMedia(baseInput({ pendingTagging: true }))
    expect(created.pendingTagging).toBe(true)
  })

  it('never changes pendingTagging on updateMedia, even when the caller passes one', async () => {
    const created = await mediaService.addMedia(baseInput({ pendingTagging: true }))

    const updated = await mediaService.updateMedia(
      created.id,
      baseInput({ pendingTagging: false, name: 'Renamed' })
    )

    expect(updated.pendingTagging).toBe(true)
  })

  it('clearPendingTagging sets pendingTagging to false and returns the refreshed model', async () => {
    const created = await mediaService.addMedia(baseInput({ pendingTagging: true }))

    const cleared = await mediaService.clearPendingTagging(created.id)

    expect(cleared.pendingTagging).toBe(false)
    const refetched = await mediaService.getMediaById(created.id)
    expect(refetched?.pendingTagging).toBe(false)
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

describe('mediaService.getMediaOrderedIds', () => {
  it('returns every matching id ordered by the given sort, ignoring limit/offset', async () => {
    const first = await mediaService.addMedia(baseInput({ name: 'a', route: '/a.png' }))
    const second = await mediaService.addMedia(baseInput({ name: 'b', route: '/b.png' }))
    const third = await mediaService.addMedia(baseInput({ name: 'c', route: '/c.png' }))

    const ids = await mediaService.getMediaOrderedIds({ limit: 1 }, { prop: 'name' })

    expect(ids).toEqual([first.id, second.id, third.id])
  })

  it('applies filters the same way as getMediaFiltered', async () => {
    const tagA = await tagService.createTag({ name: 'a' })
    const tagged = await mediaService.addMedia(
      baseInput({ name: 'tagged', route: '/tagged.png', tagIds: [tagA.id] })
    )
    await mediaService.addMedia(baseInput({ name: 'untagged', route: '/untagged.png' }))

    const ids = await mediaService.getMediaOrderedIds({ tagGroups: [[tagA.id]] })

    expect(ids).toEqual([tagged.id])
  })
})

describe('mediaService.getEntityThumbnails', () => {
  it('delegates to the repository and returns its rows', async () => {
    const tag = await tagService.createTag({ name: 'a' })
    const media = await mediaService.addMedia(baseInput({ name: 'm', route: '/m.png' }))
    await mediaService.updateMedia(media.id, {
      ...baseInput({ name: 'm', route: '/m.png' }),
      tagIds: [tag.id]
    })

    const result = await mediaService.getEntityThumbnails('tag', [tag.id])

    expect(result).toEqual([{ entityId: tag.id, route: '/m.png', type: 'image' }])
  })

  it('gives a parent series a thumbnail from media that only lives under a descendant', async () => {
    const parent = await seriesService.createSeries({ name: 'Parent' })
    const child = await seriesService.createSeries({ name: 'Child', parentId: parent.id })
    const grandchild = await seriesService.createSeries({ name: 'Grandchild', parentId: child.id })
    const media = await mediaService.addMedia(
      baseInput({ name: 'deep', route: '/deep.png', seriesIds: [grandchild.id] })
    )

    const result = await mediaService.getEntityThumbnails('series', [parent.id])

    expect(result).toEqual([{ entityId: parent.id, route: '/deep.png', type: media.type }])
  })

  it('returns nothing for a series with no media anywhere in its closure', async () => {
    const empty = await seriesService.createSeries({ name: 'Empty' })
    const other = await seriesService.createSeries({ name: 'Other' })
    await mediaService.addMedia(
      baseInput({ name: 'elsewhere', route: '/elsewhere.png', seriesIds: [other.id] })
    )

    expect(await mediaService.getEntityThumbnails('series', [empty.id])).toEqual([])
  })
})

describe('mediaService.batchUpdateAssociations', () => {
  it('adds and removes tags, characters and series for multiple media in one call', async () => {
    const tagKeep = await tagService.createTag({ name: 'keep' })
    const tagAdd = await tagService.createTag({ name: 'add' })
    const tagRemove = await tagService.createTag({ name: 'remove' })
    const character = await characterService.createCharacter({ name: 'Hero' })
    const series = await seriesService.createSeries({ name: 'Some Series' })

    const mediaA = await mediaService.addMedia(baseInput({ tagIds: [tagKeep.id, tagRemove.id] }))
    const mediaB = await mediaService.addMedia(baseInput({ route: '/b.png' }))

    await mediaService.batchUpdateAssociations({
      mediaIds: [mediaA.id, mediaB.id],
      addTagIds: [tagAdd.id],
      removeTagIds: [tagRemove.id],
      addCharacterIds: [character.id],
      removeCharacterIds: [],
      addSeriesIds: [series.id],
      removeSeriesIds: []
    })

    const reloadedA = await mediaService.getMediaById(mediaA.id)
    const reloadedB = await mediaService.getMediaById(mediaB.id)

    expect(reloadedA?.tags?.map((t) => t.id).sort()).toEqual([tagAdd.id, tagKeep.id].sort())
    expect(reloadedB?.tags?.map((t) => t.id)).toEqual([tagAdd.id])
    expect(reloadedA?.characters?.map((c) => c.id)).toEqual([character.id])
    expect(reloadedB?.characters?.map((c) => c.id)).toEqual([character.id])
    expect(reloadedA?.series?.map((s) => s.id)).toEqual([series.id])
    expect(reloadedB?.series?.map((s) => s.id)).toEqual([series.id])
  })

  it('rolls back every section if one step fails, applying nothing', async () => {
    const tag = await tagService.createTag({ name: 'sunset' })
    const media = await mediaService.addMedia(baseInput())

    await expect(
      mediaService.batchUpdateAssociations({
        mediaIds: [media.id],
        addTagIds: [tag.id],
        removeTagIds: [],
        addCharacterIds: ['does-not-exist'],
        removeCharacterIds: [],
        addSeriesIds: [],
        removeSeriesIds: []
      })
    ).rejects.toThrow()

    const reloaded = await mediaService.getMediaById(media.id)
    expect(reloaded?.tags).toEqual([])
  })
})
