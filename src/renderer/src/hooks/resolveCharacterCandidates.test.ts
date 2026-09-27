import { describe, expect, it } from 'vitest'
import type { CharacterModel, SeriesModel } from '@shared/models'
import { resolveCharacterCandidates } from './resolveCharacterCandidates'
import { matchSuggestionCandidate } from './tagSuggestionMatching'

const xc2: SeriesModel = { id: 's-xc2', name: 'Xenoblade Chronicles 2' }

describe('resolveCharacterCandidates', () => {
  it('turns inner qualifiers into a form of the base character, never a series', () => {
    const result = resolveCharacterCandidates(
      [{ name: 'pyra (pro swimmer) (xenoblade)' }, { name: 'nia (blade) (xenoblade)' }],
      [],
      []
    )
    expect(result.characters).toEqual([
      {
        name: 'Pyra (Pro Swimmer)',
        altNames: ['pyra (pro swimmer) (xenoblade)'],
        parent: { name: 'Pyra', altNames: ['pyra (xenoblade)'] }
      },
      {
        name: 'Nia (Blade)',
        altNames: ['nia (blade) (xenoblade)'],
        parent: { name: 'Nia', altNames: ['nia (xenoblade)'] }
      }
    ])
    // "xenoblade" names no library series, so no new-series chip either.
    expect(result.seriesHints).toEqual([])
  })

  it('offers the last qualifier as a series only when it names one in the library', () => {
    const result = resolveCharacterCandidates(
      [{ name: 'mythra (massive melee) (xenoblade)' }],
      [],
      [xc2]
    )
    expect(result.seriesHints).toEqual([{ name: 'Xenoblade Chronicles 2' }])
  })

  it('reads a single qualifier as a costume when the source reports another series', () => {
    const result = resolveCharacterCandidates(
      [{ name: 'inugami korone (1st costume)' }],
      [{ name: 'hololive' }],
      []
    )
    expect(result.characters[0]).toMatchObject({
      name: 'Inugami Korone (1st Costume)',
      parent: { name: 'Inugami Korone' }
    })
  })

  it('keeps a single qualifier as a series to confirm when nothing else says which series', () => {
    const result = resolveCharacterCandidates([{ name: 'sylphiette (mushoku tensei)' }], [], [])
    expect(result.characters).toEqual([
      { name: 'sylphiette', altNames: ['sylphiette (mushoku tensei)'] }
    ])
    expect(result.seriesHints).toEqual([{ name: 'mushoku tensei' }])
  })
})

describe('matchSuggestionCandidate with forms', () => {
  const pyra: CharacterModel = { id: 'c-pyra', name: 'Pyra', series: [xc2] }
  const candidate = {
    artist: null,
    tags: [],
    characters: [{ name: 'pyra (pro swimmer) (xenoblade)' }],
    series: []
  }

  it('applies the existing base character and offers the form as its child', () => {
    const result = matchSuggestionCandidate(candidate, {
      artists: [],
      tags: [],
      characters: [pyra],
      series: [xc2]
    })
    expect(result.applied.characterIds).toEqual(['c-pyra'])
    expect(result.missing.characters).toEqual(['Pyra (Pro Swimmer)'])
    expect(result.characterParents).toEqual({ 'Pyra (Pro Swimmer)': 'Pyra' })
  })

  it('applies the form itself once it exists', () => {
    const form: CharacterModel = {
      id: 'c-swim',
      name: 'Pyra (Pro Swimmer)',
      series: [],
      parentId: 'c-pyra'
    }
    const result = matchSuggestionCandidate(candidate, {
      artists: [],
      tags: [],
      characters: [pyra, form],
      series: [xc2]
    })
    expect(result.applied.characterIds).toEqual(['c-swim'])
    expect(result.missing.characters).toEqual([])
  })
})
