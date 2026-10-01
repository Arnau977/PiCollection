import { describe, expect, it } from 'vitest'
import { routeSourceTags } from './useSourceSuggestions'

describe('routeSourceTags', () => {
  // Pixiv sends every name as a tag.
  it('offers a tag the library only has as a series or character as that, and keeps real tags', () => {
    const routed = routeSourceTags(
      {
        tags: ['Genshin Impact', 'furina', 'Smile', 'work illustration'],
        characters: [],
        series: []
      },
      {
        tags: [{ id: 't1', name: 'Smile' }],
        characters: [{ id: 'c1', name: 'Furina', series: [] }],
        series: [{ id: 's1', name: 'Genshin Impact' }]
      }
    )

    expect(routed).toEqual({
      tags: ['Smile', 'work illustration'],
      characters: ['furina'],
      series: ['Genshin Impact']
    })
  })
})
