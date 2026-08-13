// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { TagModel } from '@shared/models'
import { useWd14Suggestions } from './useWd14Suggestions'

const tags: TagModel[] = [{ id: 't1', name: 'landscape' }]

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
    ...renderHook(() => useWd14Suggestions({ tags, onApplyExisting }))
  }
}

describe('useWd14Suggestions', () => {
  it('starts idle', () => {
    const { result } = renderSuggestions()
    expect(result.current.status).toBe('idle')
    expect(result.current.missing).toEqual([])
  })

  it('runs a lookup, applies existing tags once, and exposes missing names sorted by score', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: [
          { name: 'landscape', score: 0.9 },
          { name: 'low score tag', score: 0.4 },
          { name: 'high score tag', score: 0.8 }
        ]
      })
    )
    const { result, onApplyExisting } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })

    expect(window.api.wd14Tagger.suggestTags).toHaveBeenCalledWith('/pic.png')
    expect(result.current.status).toBe('ready')
    expect(onApplyExisting).toHaveBeenCalledWith(['t1'])
    expect(result.current.missing).toEqual([
      { name: 'high score tag', score: 0.8 },
      { name: 'low score tag', score: 0.4 }
    ])
    expect(result.current.appliedCount).toBe(1)
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

  it('dismiss removes only the named entry', async () => {
    setApi(
      vi.fn().mockResolvedValue({
        success: true,
        data: [
          { name: 'tag a', score: 0.9 },
          { name: 'tag b', score: 0.8 }
        ]
      })
    )
    const { result } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })
    expect(result.current.missing).toHaveLength(2)

    act(() => {
      result.current.dismiss('tag a')
    })
    expect(result.current.missing).toEqual([{ name: 'tag b', score: 0.8 }])
  })

  it('reset clears the result back to idle', async () => {
    setApi(vi.fn().mockResolvedValue({ success: true, data: [{ name: 'tag a', score: 0.9 }] }))
    const { result } = renderSuggestions()

    await act(async () => {
      await result.current.run('/pic.png')
    })
    expect(result.current.status).toBe('ready')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.missing).toEqual([])
    expect(result.current.appliedCount).toBe(0)
  })
})
