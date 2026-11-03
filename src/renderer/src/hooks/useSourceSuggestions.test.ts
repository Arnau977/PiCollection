// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { routeSourceTags, useSourceSuggestions } from './useSourceSuggestions'

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

describe('useSourceSuggestions', () => {
  it("doesn't offer a tag the media already has automatically", () => {
    const { result } = renderHook(() =>
      useSourceSuggestions({
        metadata: { site: 'danbooru', tags: ['absurdres', 'smile'], characters: [], series: [] },
        input: { tagIds: [] } as never,
        autoTagIds: ['t1'],
        artists: [],
        tags: [
          { id: 't1', name: 'Absurdres' },
          { id: 't2', name: 'Smile' }
        ] as never,
        characters: [],
        series: []
      })
    )

    expect(result.current.existing.tags.map((tag) => tag.id)).toEqual(['t2'])
  })
})
