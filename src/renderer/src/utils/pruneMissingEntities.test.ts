import { describe, expect, it } from 'vitest'
import { pruneMissingEntities } from './pruneMissingEntities'

const known = {
  artists: new Set(['a1']),
  tags: new Set(['t1', 't2']),
  characters: new Set(['c1']),
  series: new Set(['s1'])
}

describe('pruneMissingEntities', () => {
  it('drops ids of entities that no longer exist, exclusions and exact ids included', () => {
    const pruned = pruneMissingEntities(
      {
        sfw: true,
        artistId: 'gone',
        tagGroups: [['t1', '-gone'], ['gone']],
        characterGroups: [['gone']],
        exactCharacterIds: ['gone'],
        seriesGroups: [['s1']],
        exactSeriesIds: ['s1']
      },
      known
    )

    expect(pruned).toEqual({
      sfw: true,
      artistId: undefined,
      tagGroups: [['t1']],
      characterGroups: undefined,
      exactCharacterIds: undefined,
      seriesGroups: [['s1']],
      exactSeriesIds: ['s1']
    })
  })

  it('returns the same object when every id still exists', () => {
    const filters = { artistId: 'a1', tagGroups: [['t1', '-t2']] }
    expect(pruneMissingEntities(filters, known)).toBe(filters)
  })
})
