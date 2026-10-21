import { describe, expect, it } from 'vitest'
import { diffTaxonomy } from './taxonomyDiff'

describe('diffTaxonomy', () => {
  it('splits each category into left-only, right-only and shared names', () => {
    const diff = diffTaxonomy(
      { characters: ['Kaguya', 'Hayasaka'], series: ['Kaguya-sama'], tags: ['bunny', 'smile'] },
      { characters: ['Hayasaka'], series: ['Kaguya-sama'], tags: ['smile', 'leotard'] }
    )
    expect(diff.onlyLeft).toEqual({ characters: ['Kaguya'], series: [], tags: ['bunny'] })
    expect(diff.onlyRight).toEqual({ characters: [], series: [], tags: ['leotard'] })
    expect(diff.both).toEqual({
      characters: ['Hayasaka'],
      series: ['Kaguya-sama'],
      tags: ['smile']
    })
  })
})
