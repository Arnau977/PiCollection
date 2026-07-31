import { describe, expect, it } from 'vitest'
import type { CharacterModel } from '@shared/models'
import { withImpliedSeries } from './withImpliedSeries'

const wonderland = { id: 's1', name: 'Wonderland' }
const lookingGlass = { id: 's2', name: 'Looking Glass' }

function characters(): CharacterModel[] {
  return [
    { id: 'c1', name: 'Alice', series: [wonderland] },
    { id: 'c2', name: 'Red Queen', series: [wonderland, lookingGlass] },
    { id: 'c3', name: 'Bob', series: [] }
  ]
}

describe('withImpliedSeries', () => {
  it('adds the series of a character that belongs to exactly one', () => {
    expect(withImpliedSeries(characters(), ['c1'], [])).toEqual(['s1'])
  })

  it('does not add a series for a character that belongs to several', () => {
    expect(withImpliedSeries(characters(), ['c2'], [])).toEqual([])
  })

  it('does not add a series for a character that belongs to none', () => {
    expect(withImpliedSeries(characters(), ['c3'], [])).toEqual([])
  })

  it('does not duplicate an already-present series', () => {
    expect(withImpliedSeries(characters(), ['c1'], ['s1'])).toEqual(['s1'])
  })

  it('ignores an unknown character id', () => {
    expect(withImpliedSeries(characters(), ['does-not-exist'], [])).toEqual([])
  })
})
