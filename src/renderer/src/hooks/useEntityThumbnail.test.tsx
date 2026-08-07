// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useEntityThumbnails } from './useEntityThumbnail'

function setApi(api: unknown): void {
  Object.defineProperty(window, 'api', { value: api, writable: true, configurable: true })
}

beforeEach(() => {
  setApi({
    media: {
      getEntityThumbnails: vi.fn().mockResolvedValue({ success: true, data: [] })
    }
  })
})

describe('useEntityThumbnails', () => {
  it('marks ids with no eligible thumbnail as resolved (null), not stuck loading', async () => {
    const getEntityThumbnails = vi.fn().mockResolvedValue({
      success: true,
      // Only 't1' comes back - 't2' has zero eligible media and is simply absent,
      // matching findEntityThumbnails' real behavior.
      data: [{ entityId: 't1', route: '/pics/a.png', type: 'image' }]
    })
    setApi({ media: { getEntityThumbnails } })

    const { result } = renderHook(() => useEntityThumbnails('tag', ['t1', 't2']))

    // Before the round trip resolves, neither id is in the map yet ("not yet asked").
    expect(result.current.has('t1')).toBe(false)
    expect(result.current.has('t2')).toBe(false)

    await waitFor(() => expect(result.current.has('t2')).toBe(true))

    // 't1' resolved to a real entry.
    expect(result.current.get('t1')).toEqual({ route: '/pics/a.png', type: 'image' })
    // 't2' resolved to "asked, none found" - present in the map with value null,
    // not absent - so a caller's `!thumbnails.has(id)` loading check turns false.
    expect(result.current.has('t2')).toBe(true)
    expect(result.current.get('t2')).toBeNull()
  })

  it('does not clear previously resolved entries when the id list changes', async () => {
    const getEntityThumbnails = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [{ entityId: 't1', route: '/pics/a.png', type: 'image' }]
      })
      .mockResolvedValueOnce({
        success: true,
        data: [{ entityId: 't2', route: '/pics/b.png', type: 'image' }]
      })
    setApi({ media: { getEntityThumbnails } })

    const { result, rerender } = renderHook(({ ids }) => useEntityThumbnails('tag', ids), {
      initialProps: { ids: ['t1'] }
    })

    await waitFor(() => expect(result.current.get('t1')?.route).toBe('/pics/a.png'))

    // Simulate scrolling: the visible id list changes to a different set that no
    // longer includes 't1'. The already-resolved 't1' entry must survive the merge
    // instead of flickering back to a loading state.
    act(() => {
      rerender({ ids: ['t2'] })
    })

    await waitFor(() => expect(result.current.get('t2')?.route).toBe('/pics/b.png'))
    expect(result.current.get('t1')).toEqual({ route: '/pics/a.png', type: 'image' })
  })
})
