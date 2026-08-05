// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type {
  ArtistModel,
  CharacterModel,
  SauceNaoMatch,
  SeriesModel,
  TagModel
} from '@shared/models'
import { useSauceNaoSuggestions } from './useSauceNaoSuggestions'

const artists: ArtistModel[] = [{ id: 'a1', name: 'Known Artist' }]
const tags: TagModel[] = [{ id: 't1', name: 'landscape' }]
const characters: CharacterModel[] = [{ id: 'c1', name: 'Ishtar', series: [] }]
const series: SeriesModel[] = [{ id: 's1', name: 'Fate/Grand Order' }]

function makeMatch(overrides: Partial<SauceNaoMatch> = {}): SauceNaoMatch {
  return {
    similarity: 90,
    indexName: 'Danbooru',
    sourceUrl: 'https://danbooru.donmai.us/posts/1',
    artist: { name: 'Known Artist' },
    characters: [{ name: 'Ishtar' }, { name: 'New Character' }],
    series: [{ name: 'Fate/Grand Order' }],
    seriesHints: [],
    tags: [{ name: 'landscape' }, { name: 'new tag' }],
    ...overrides
  }
}

function setApi(lookup: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(window, 'api', {
    value: { sauceNao: { lookup } },
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
    ...renderHook(() =>
      useSauceNaoSuggestions({ artists, tags, characters, series, onApplyExisting })
    )
  }
}

describe('useSauceNaoSuggestions', () => {
  it('starts idle', () => {
    const { result } = renderSuggestions()
    expect(result.current.status).toBe('idle')
    expect(result.current.match).toBeNull()
  })

  it('runs a lookup, applies existing matches once, and exposes missing names', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: { match: makeMatch(), remaining: { short: 5, long: 90 } }
      })
    )
    const { result, onApplyExisting } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })

    expect(window.api.sauceNao.lookup).toHaveBeenCalledWith('/pic.png')
    expect(result.current.status).toBe('ready')
    expect(onApplyExisting).toHaveBeenCalledTimes(1)
    expect(onApplyExisting).toHaveBeenCalledWith({
      artistId: 'a1',
      tagIds: ['t1'],
      characterIds: ['c1'],
      seriesIds: ['s1']
    })
    expect(result.current.missing).toEqual({
      artist: [],
      tags: ['new tag'],
      characters: ['New Character'],
      series: []
    })
    expect(result.current.appliedCount).toBe(4)
    expect(result.current.remaining).toEqual({ short: 5, long: 90 })
  })

  it('capitalizes missing character and series names, but not tags or artist', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: {
          match: makeMatch({
            artist: { name: 'unknown artist' },
            characters: [{ name: 'new character' }],
            series: [{ name: 'new series' }],
            tags: [{ name: 'new tag' }]
          }),
          remaining: { short: 5, long: 90 }
        }
      })
    )
    const { result } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })

    expect(result.current.missing.characters).toEqual(['New character'])
    expect(result.current.missing.series).toEqual(['New series'])
    expect(result.current.missing.tags).toEqual(['new tag'])
    expect(result.current.missing.artist).toEqual(['unknown artist'])
  })

  it('resolves to a null match without applying anything when nothing matched', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: { match: null, remaining: { short: 5, long: 90 } }
      })
    )
    const { result, onApplyExisting } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.match).toBeNull()
    expect(onApplyExisting).not.toHaveBeenCalled()
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
    const lookup = vi.fn().mockReturnValue(pending)
    setApi(lookup)
    const { result } = renderSuggestions()

    let firstRun: Promise<void> = Promise.resolve()
    act(() => {
      firstRun = result.current.run('/a.png')
    })
    await waitFor(() => expect(result.current.status).toBe('loading'))

    await act(async () => {
      await result.current.run('/b.png')
    })
    expect(lookup).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveLookup({ success: true, data: { match: null, remaining: { short: 0, long: 0 } } })
      await firstRun
    })
  })

  it('dismiss removes only the named entry from its category', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: { match: makeMatch(), remaining: { short: 0, long: 0 } }
      })
    )
    const { result } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })
    expect(result.current.missing.tags).toEqual(['new tag'])

    act(() => {
      result.current.dismiss('tags', 'new tag')
    })
    expect(result.current.missing.tags).toEqual([])
    expect(result.current.missing.characters).toEqual(['New Character'])
  })

  it('reset clears the result back to idle', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: { match: makeMatch(), remaining: { short: 0, long: 0 } }
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
    expect(result.current.match).toBeNull()
    expect(result.current.missing).toEqual({ artist: [], tags: [], characters: [], series: [] })
  })

  it('disambiguates same-named characters using the series SauceNAO returned', async () => {
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
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: {
          match: makeMatch({ characters: [{ name: 'Ishtar' }] }),
          remaining: { short: 5, long: 90 }
        }
      })
    )
    const onApplyExisting = vi.fn()
    const { result } = renderHook(() =>
      useSauceNaoSuggestions({
        artists,
        tags,
        // Deliberately listed in this order - the old first-match-wins
        // behavior would incorrectly resolve to 'c2'.
        characters: [otherIshtar, fgoIshtar],
        series,
        onApplyExisting
      })
    )

    await act(async () => {
      await result.current.run('/pic.png')
    })

    expect(onApplyExisting).toHaveBeenCalledWith(expect.objectContaining({ characterIds: ['c1'] }))
  })
})
