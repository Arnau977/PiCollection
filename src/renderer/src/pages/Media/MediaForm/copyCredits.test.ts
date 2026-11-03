import { describe, expect, it } from 'vitest'
import type { MediaInput, MediaModel } from '@shared/models'
import { copyCreditsFrom } from './copyCredits'

const match = {
  artist: { id: 'a1', name: 'Artist' },
  characters: [{ id: 'c1', name: 'Bronya' }],
  series: [{ id: 's1', name: 'Honkai' }]
} as MediaModel

const input = (overrides: Partial<MediaInput> = {}): MediaInput =>
  ({ tagIds: ['t1'], characterIds: [], seriesIds: [], ...overrides }) as MediaInput

describe('copyCreditsFrom', () => {
  it("adds the match's artist, characters and series, keeping the form's own", () => {
    expect(copyCreditsFrom(match, input({ characterIds: ['c2'] }))).toMatchObject({
      artistId: 'a1',
      characterIds: ['c2', 'c1'],
      seriesIds: ['s1'],
      tagIds: ['t1']
    })
  })

  it('never replaces an artist already picked, and is null once nothing would change', () => {
    const filled = input({ artistId: 'a2', characterIds: ['c1'], seriesIds: ['s1'] })
    expect(copyCreditsFrom(match, filled)).toBeNull()
  })
})
