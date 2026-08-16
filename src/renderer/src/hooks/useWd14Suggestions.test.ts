// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { CharacterModel, SeriesModel, TagModel } from '@shared/models'
import { useWd14Suggestions } from './useWd14Suggestions'

const tags: TagModel[] = [{ id: 't1', name: 'landscape' }]
const characters: CharacterModel[] = [{ id: 'c1', name: 'Ishtar', series: [] }]
const series: SeriesModel[] = [{ id: 's1', name: 'Fate/Grand Order' }]

const EMPTY_MISSING = { artist: [], tags: [], characters: [], series: [] }

function setApi(suggestTags: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(window, 'api', {
    value: { wd14Tagger: { suggestTags } },
    writable: true,
    configurable: true
  })
}

beforeEach(() => {
  setApi(vi.fn())
})

function renderSuggestions(onApplyExisting = vi.fn()) {
  return {
    onApplyExisting,
    ...renderHook(() => useWd14Suggestions({ tags, characters, series, onApplyExisting }))
  }
}

describe('useWd14Suggestions', () => {
  it('starts idle', () => {
    const { result } = renderSuggestions()
    expect(result.current.status).toBe('idle')
    expect(result.current.missing).toEqual(EMPTY_MISSING)
    expect(result.current.rating).toBeNull()
  })

  it('exposes the single highest-scoring rating tag, separately from missing suggestions', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: [
          { name: 'landscape', score: 0.9, category: 'general' },
          { name: 'explicit', score: 0.91, category: 'rating' }
        ]
      })
    )
    const { result } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })

    expect(result.current.rating).toEqual({ name: 'explicit', score: 0.91, category: 'rating' })
    expect(result.current.missing).toEqual(EMPTY_MISSING)
  })

  it('reset clears the rating', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: [{ name: 'explicit', score: 0.9, category: 'rating' }]
      })
    )
    const { result } = renderSuggestions()
    await act(async () => {
      await result.current.run('/pic.png')
    })
    expect(result.current.rating).not.toBeNull()

    act(() => {
      result.current.reset()
    })

    expect(result.current.rating).toBeNull()
  })

  it('runs a lookup, applies existing tags once, and exposes missing names sorted by score', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: [
          { name: 'landscape', score: 0.9, category: 'general' },
          { name: 'low score tag', score: 0.4, category: 'general' },
          { name: 'high score tag', score: 0.8, category: 'general' }
        ]
      })
    )
    const { result, onApplyExisting } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })

    expect(window.api.wd14Tagger.suggestTags).toHaveBeenCalledWith('/pic.png')
    expect(result.current.status).toBe('ready')
    expect(onApplyExisting).toHaveBeenCalledWith({
      artistId: undefined,
      tagIds: ['t1'],
      characterIds: [],
      seriesIds: []
    })
    expect(result.current.missing.tags).toEqual([
      { name: 'high score tag', score: 0.8 },
      { name: 'low score tag', score: 0.4 }
    ])
    expect(result.current.appliedCount).toBe(1)
  })

  it('routes character/copyright suggestions to their own categories, existing matches applied silently', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: [
          { name: 'ishtar', score: 0.9, category: 'character' },
          { name: 'new character', score: 0.88, category: 'character' },
          { name: 'new series', score: 0.87, category: 'copyright' }
        ]
      })
    )
    const { result, onApplyExisting } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })

    expect(onApplyExisting).toHaveBeenCalledWith({
      artistId: undefined,
      tagIds: [],
      characterIds: ['c1'],
      seriesIds: []
    })
    expect(result.current.missing.characters).toEqual([{ name: 'New character', score: 0.88 }])
    expect(result.current.missing.series).toEqual([{ name: 'New series', score: 0.87 }])
  })

  it('matches an already-known character even when WD14 bakes its series into the tag name', async () => {
    // Unlike SauceNAO, WD14's own character tags carry their disambiguating
    // series right inside the name ("seele (honkai: star rail)" as one
    // Danbooru tag) - matching that raw string against the library's plain
    // "Seele" must not treat it as a brand new character.
    const wd14Characters = [{ id: 'c-seele', name: 'Seele', series: [] }]
    const wd14Series = [{ id: 's-hsr', name: 'Honkai: Star Rail' }]
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: [
          { name: 'seele (honkai: star rail)', score: 0.9, category: 'character' },
          { name: 'honkai: star rail', score: 0.92, category: 'copyright' }
        ]
      })
    )
    const onApplyExisting = vi.fn()
    const { result } = renderHook(() =>
      useWd14Suggestions({
        tags,
        characters: wd14Characters,
        series: wd14Series,
        onApplyExisting
      })
    )

    await act(async () => {
      await result.current.run('/pic.png')
    })

    expect(onApplyExisting).toHaveBeenCalledWith({
      artistId: undefined,
      tagIds: [],
      characterIds: ['c-seele'],
      seriesIds: ['s-hsr']
    })
    expect(result.current.missing.characters).toEqual([])
    // The qualifier peeled off "seele (honkai: star rail)" just repeats what
    // the copyright category already reported directly - no redundant chip.
    expect(result.current.missing.series).toEqual([])
  })

  it('surfaces an error and does not apply anything on failure', async () => {
    setApi(
      vi
        .fn()
        .mockResolvedValue({ success: false, error: { code: 'INTERNAL', message: 'Offline.' } })
    )
    const { result, onApplyExisting } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Offline.')
    expect(onApplyExisting).not.toHaveBeenCalled()
  })

  it('ignores a run() call while already loading', async () => {
    let resolveLookup: (value: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      resolveLookup = resolve
    })
    const suggestTags = vi.fn().mockReturnValue(pending)
    setApi(suggestTags)
    const { result } = renderSuggestions()

    let firstRun: Promise<void> = Promise.resolve()
    act(() => {
      firstRun = result.current.run('/a.png')
    })
    await waitFor(() => expect(result.current.status).toBe('loading'))

    await act(async () => {
      await result.current.run('/b.png')
    })
    expect(suggestTags).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveLookup({ success: true, data: [] })
      await firstRun
    })
  })

  it('dismiss removes only the named entry from its own category', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: [
          { name: 'tag a', score: 0.9, category: 'general' },
          { name: 'tag b', score: 0.8, category: 'general' }
        ]
      })
    )
    const { result } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })
    expect(result.current.missing.tags).toHaveLength(2)

    act(() => {
      result.current.dismiss('tags', 'tag a')
    })
    expect(result.current.missing.tags).toEqual([{ name: 'tag b', score: 0.8 }])
  })

  it('reset clears the result back to idle', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: [{ name: 'tag a', score: 0.9, category: 'general' }]
      })
    )
    const { result } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })
    expect(result.current.status).toBe('ready')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.missing).toEqual(EMPTY_MISSING)
    expect(result.current.appliedCount).toBe(0)
  })
})
