import { describe, expect, it } from 'vitest'
import type { CharacterModel } from '@shared/models'
import { sortCharactersByRelevance } from './sortCharactersBySeries'

const wonderland = { id: 's1', name: 'Wonderland' }
const lookingGlass = { id: 's2', name: 'Looking Glass' }

function characters(): CharacterModel[] {
  return [
    { id: 'c1', name: 'Alice', series: [wonderland] },
    { id: 'c2', name: 'Red Queen', series: [lookingGlass] },
    { id: 'c3', name: 'Bob', series: [] },
    { id: 'c4', name: 'Cheshire Cat', series: [wonderland, lookingGlass] }
  ]
}

describe('sortCharactersByRelevance', () => {
  it('returns the original order when no series is selected', () => {
    const result = sortCharactersByRelevance(characters(), [])
    expect(result.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4'])
  })

  it('puts characters linked to a selected series first, rest unchanged after', () => {
    const result = sortCharactersByRelevance(characters(), ['s1'])
    expect(result.map((c) => c.id)).toEqual(['c1', 'c4', 'c2', 'c3'])
  })

  it('matches a character linked to any of several selected series', () => {
    const result = sortCharactersByRelevance(characters(), ['s2'])
    expect(result.map((c) => c.id)).toEqual(['c2', 'c4', 'c1', 'c3'])
  })

  it('does not mutate the input array', () => {
    const input = characters()
    const original = [...input]
    sortCharactersByRelevance(input, ['s1'])
    expect(input).toEqual(original)
  })
})
