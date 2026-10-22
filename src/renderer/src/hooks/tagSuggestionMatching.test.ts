import { describe, expect, it } from 'vitest'
import type { ArtistModel, CharacterModel, SeriesModel, TagModel } from '@shared/models'
import { matchSuggestionCandidate, type TagSuggestionCandidate } from './tagSuggestionMatching'

const artists: ArtistModel[] = [{ id: 'a1', name: 'Known Artist' }]
const tags: TagModel[] = [{ id: 't1', name: 'landscape' }]
const characters: CharacterModel[] = [{ id: 'c1', name: 'Ishtar', series: [] }]
const series: SeriesModel[] = [{ id: 's1', name: 'Fate/Grand Order' }]
const entities = { artists, tags, characters, series }

function makeCandidate(overrides: Partial<TagSuggestionCandidate> = {}): TagSuggestionCandidate {
  return {
    artist: { name: 'Known Artist' },
    characters: [{ name: 'Ishtar' }, { name: 'New Character' }],
    series: [{ name: 'Fate/Grand Order' }],
    tags: [{ name: 'landscape' }, { name: 'new tag' }],
    ...overrides
  }
}

describe('matchSuggestionCandidate', () => {
  it('splits each category into applied ids and missing names', () => {
    const result = matchSuggestionCandidate(makeCandidate(), entities)

    expect(result.applied).toEqual({
      artistId: 'a1',
      tagIds: ['t1'],
      characterIds: ['c1'],
      seriesIds: ['s1']
    })
    expect(result.missing).toEqual({
      artist: [],
      tags: ['new tag'],
      characters: ['New Character'],
      series: []
    })
    expect(result.appliedCount).toBe(4)
  })

  it('capitalizes missing character and series names, but not tags or artist', () => {
    const result = matchSuggestionCandidate(
      makeCandidate({
        artist: { name: 'unknown artist' },
        characters: [{ name: 'new character' }],
        series: [{ name: 'new series' }],
        tags: [{ name: 'new tag' }]
      }),
      entities
    )

    expect(result.missing.characters).toEqual(['New character'])
    expect(result.missing.series).toEqual(['New series'])
    expect(result.missing.tags).toEqual(['new tag'])
    expect(result.missing.artist).toEqual(['unknown artist'])
  })

  it('treats a null artist as nothing suggested, not a miss', () => {
    const result = matchSuggestionCandidate(makeCandidate({ artist: null }), entities)
    expect(result.missing.artist).toEqual([])
    expect(result.applied.artistId).toBeUndefined()
  })

  it('never silently applies a series hint, even one that matches an existing series by name', () => {
    const result = matchSuggestionCandidate(
      makeCandidate({
        characters: [{ name: 'Ishtar (Fate/Grand Order)' }],
        series: []
      }),
      entities
    )

    expect(result.applied.seriesIds).toEqual([])
    expect(result.missing.series).toEqual(['Fate/Grand Order'])
  })

  it('drops a series hint that names the sole series already implied by an applied character', () => {
    const fgoIshtar: CharacterModel = {
      id: 'c1',
      name: 'Ishtar',
      series: [{ id: 's1', name: 'Fate/Grand Order' }]
    }
    const result = matchSuggestionCandidate(
      makeCandidate({
        characters: [{ name: 'Ishtar (Fate/Grand Order)' }],
        series: []
      }),
      { ...entities, characters: [fgoIshtar] }
    )

    expect(result.applied.characterIds).toEqual(['c1'])
    expect(result.missing.series).toEqual([])
  })

  it('still surfaces a series hint when the matched character has more than one series', () => {
    const ambiguousIshtar: CharacterModel = {
      id: 'c1',
      name: 'Ishtar',
      series: [
        { id: 's1', name: 'Fate/Grand Order' },
        { id: 's2', name: 'Some Other Series' }
      ]
    }
    const result = matchSuggestionCandidate(
      makeCandidate({
        characters: [{ name: 'Ishtar (Fate/Grand Order)' }],
        series: []
      }),
      { ...entities, characters: [ambiguousIshtar] }
    )

    expect(result.applied.characterIds).toEqual(['c1'])
    expect(result.missing.series).toEqual(['Fate/Grand Order'])
  })

  it('disambiguates same-named characters using the series context', () => {
    const otherIshtar: CharacterModel = {
      id: 'c2',
      name: 'Ishtar',
      series: [{ id: 's2', name: 'Some Other Series' }]
    }
    const fgoIshtar: CharacterModel = {
      id: 'c1',
      name: 'Ishtar',
      series: [{ id: 's1', name: 'Fate/Grand Order' }]
    }
    const result = matchSuggestionCandidate(makeCandidate({ characters: [{ name: 'Ishtar' }] }), {
      ...entities,
      // Deliberately listed in this order - the old first-match-wins
      // behavior would incorrectly resolve to 'c2'.
      characters: [otherIshtar, fgoIshtar]
    })

    expect(result.applied.characterIds).toEqual(['c1'])
  })

  it('keeps only the most specific series when suggestions span a parent/child chain', () => {
    const nintendo: SeriesModel = { id: 's-nintendo', name: 'Nintendo' }
    const fireEmblem: SeriesModel = { id: 's-fe', name: 'Fire Emblem', parentId: 's-nintendo' }
    const fireEmblemHeroes: SeriesModel = {
      id: 's-feh',
      name: 'Fire Emblem Heroes',
      parentId: 's-fe'
    }
    const result = matchSuggestionCandidate(
      makeCandidate({
        characters: [],
        series: [{ name: 'Nintendo' }, { name: 'Fire Emblem' }, { name: 'Fire Emblem Heroes' }]
      }),
      { ...entities, series: [nintendo, fireEmblem, fireEmblemHeroes] }
    )

    expect(result.applied.seriesIds).toEqual(['s-feh'])
  })

  it('keeps only the most specific character when suggestions span a parent/child chain', () => {
    const miku: CharacterModel = { id: 'c-miku', name: 'Hatsune Miku', series: [] }
    const mikuCostume: CharacterModel = {
      id: 'c-miku-costume',
      name: 'Hatsune Miku (Symphony)',
      series: [],
      parentId: 'c-miku'
    }
    const result = matchSuggestionCandidate(
      makeCandidate({
        series: [],
        characters: [{ name: 'Hatsune Miku' }, { name: 'Hatsune Miku (Symphony)' }]
      }),
      { ...entities, characters: [miku, mikuCostume] }
    )

    expect(result.applied.characterIds).toEqual(['c-miku-costume'])
  })
})

describe('matchSuggestionCandidate with expys', () => {
  const hi3: SeriesModel = { id: 'hi3', name: 'Honkai Impact 3rd' }
  const hsr: SeriesModel = { id: 'hsr', name: 'Honkai: Star Rail' }
  const yae: CharacterModel = { id: 'yae', name: 'Yae Sakura', series: [hi3] }
  const evanescia: CharacterModel = {
    id: 'eva',
    name: 'Evanescia',
    series: [hsr],
    inspiredByIds: ['yae']
  }
  const library = { artists: [], tags: [], characters: [yae, evanescia], series: [hi3, hsr] }

  it('holds back the original and her own series instead of applying them', () => {
    const result = matchSuggestionCandidate(
      {
        artist: null,
        tags: [],
        characters: [{ name: 'Yae Sakura' }],
        series: [{ name: 'Honkai Impact 3rd' }]
      },
      library
    )

    expect(result.applied.characterIds).toEqual([])
    expect(result.applied.seriesIds).toEqual([])
    expect(result.held).toEqual([
      {
        original: { id: 'yae', name: 'Yae Sakura' },
        expys: [{ id: 'eva', name: 'Evanescia' }],
        seriesIds: ['hi3']
      }
    ])
    expect(result.appliedCount).toBe(0)
  })

  it('still applies a series another recognized character belongs to', () => {
    const mei: CharacterModel = { id: 'mei', name: 'Raiden Mei', series: [hi3] }
    const result = matchSuggestionCandidate(
      {
        artist: null,
        tags: [],
        characters: [{ name: 'Yae Sakura' }, { name: 'Raiden Mei' }],
        series: [{ name: 'Honkai Impact 3rd' }]
      },
      { ...library, characters: [...library.characters, mei] }
    )

    expect(result.applied).toMatchObject({ characterIds: ['mei'], seriesIds: ['hi3'] })
    expect(result.held[0].seriesIds).toEqual([])
  })
})
