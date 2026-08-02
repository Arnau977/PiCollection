import { vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '' }
}))

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'
import { statsService } from './stats.service'
import { mediaService } from './media.service'
import { tagService } from './tag.service'
import { artistService } from './artist.service'
import { characterService } from './character.service'
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
    name: 'media',
    type: 'image',
    route: '/some/path.png',
    sfw: true,
    isAiGenerated: false,
    ...overrides
  }
}

describe('statsService.getSummary', () => {
  it('returns empty lists when there is no media', async () => {
    const summary = await statsService.getSummary()
    expect(summary).toEqual({ topArtists: [], topTags: [], topCharacters: [], topSeries: [] })
  })

  it('ranks artists, tags, characters and series by how much media references them', async () => {
    const popularArtist = await artistService.createArtist({ name: 'Popular Artist' })
    const quietArtist = await artistService.createArtist({ name: 'Quiet Artist' })
    const popularTag = await tagService.createTag({ name: 'popular-tag' })
    const quietTag = await tagService.createTag({ name: 'quiet-tag' })
    const popularCharacter = await characterService.createCharacter({ name: 'Popular Character' })
    const popularSeries = await seriesService.createSeries({ name: 'Popular Series' })

    await mediaService.addMedia(
      baseInput({
        name: 'a',
        route: '/some/path-a.png',
        artistId: popularArtist.id,
        tagIds: [popularTag.id],
        characterIds: [popularCharacter.id],
        seriesIds: [popularSeries.id]
      })
    )
    await mediaService.addMedia(
      baseInput({
        name: 'b',
        route: '/some/path-b.png',
        artistId: popularArtist.id,
        tagIds: [popularTag.id],
        characterIds: [popularCharacter.id],
        seriesIds: [popularSeries.id]
      })
    )
    await mediaService.addMedia(
      baseInput({
        name: 'c',
        route: '/some/path-c.png',
        artistId: quietArtist.id,
        tagIds: [quietTag.id]
      })
    )

    const summary = await statsService.getSummary()

    expect(summary.topArtists[0]).toEqual({
      id: popularArtist.id,
      name: 'Popular Artist',
      count: 2
    })
    expect(summary.topTags[0]).toEqual({ id: popularTag.id, name: 'popular-tag', count: 2 })
    expect(summary.topCharacters[0]).toEqual({
      id: popularCharacter.id,
      name: 'Popular Character',
      count: 2
    })
    expect(summary.topSeries[0]).toEqual({ id: popularSeries.id, name: 'Popular Series', count: 2 })
  })

  it('does not count an artist/tag/character/series that has no media', async () => {
    await artistService.createArtist({ name: 'Unused Artist' })
    await tagService.createTag({ name: 'unused-tag' })
    await characterService.createCharacter({ name: 'Unused Character' })
    await seriesService.createSeries({ name: 'Unused Series' })

    const summary = await statsService.getSummary()

    expect(summary).toEqual({ topArtists: [], topTags: [], topCharacters: [], topSeries: [] })
  })
})
