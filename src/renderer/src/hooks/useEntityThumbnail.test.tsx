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

  it('resolves requested ids to null when the IPC call reports failure', async () => {
    const getEntityThumbnails = vi
      .fn()
      .mockResolvedValue({ success: false, error: { code: 'DB_ERROR', message: 'boom' } })
    setApi({ media: { getEntityThumbnails } })

    const { result } = renderHook(() => useEntityThumbnails('tag', ['t1', 't2']))

    // Both ids must land in the map (as null) rather than staying absent, which
    // callers read as "still loading" - a failed request would otherwise shimmer forever.
    await waitFor(() => expect(result.current.has('t1')).toBe(true))
    expect(result.current.get('t1')).toBeNull()
    expect(result.current.has('t2')).toBe(true)
    expect(result.current.get('t2')).toBeNull()
  })

  it('resolves requested ids to null when the IPC promise rejects', async () => {
    const getEntityThumbnails = vi.fn().mockRejectedValue(new Error('channel closed'))
    setApi({ media: { getEntityThumbnails } })

    const { result } = renderHook(() => useEntityThumbnails('tag', ['t1', 't2']))

    await waitFor(() => expect(result.current.has('t1')).toBe(true))
    expect(result.current.get('t1')).toBeNull()
    expect(result.current.get('t2')).toBeNull()
  })

  it('only requests ids that are not already resolved', async () => {
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
    expect(getEntityThumbnails).toHaveBeenCalledTimes(1)
    expect(getEntityThumbnails).toHaveBeenLastCalledWith('tag', ['t1'])

    // A sort toggle / search keystroke re-orders and extends the visible list.
    // Only the genuinely-new id may be re-requested: re-asking for 't1' would
    // hand back a different ORDER BY RANDOM() thumbnail and visibly re-shuffle it.
    act(() => {
      rerender({ ids: ['t2', 't1'] })
    })

    await waitFor(() => expect(result.current.get('t2')?.route).toBe('/pics/b.png'))
    expect(getEntityThumbnails).toHaveBeenCalledTimes(2)
    expect(getEntityThumbnails).toHaveBeenLastCalledWith('tag', ['t2'])
    expect(result.current.get('t1')).toEqual({ route: '/pics/a.png', type: 'image' })
  })

  it('does not re-request ids that resolved to no thumbnail when only the order changes', async () => {
    const getEntityThumbnails = vi.fn().mockResolvedValue({ success: true, data: [] })
    setApi({ media: { getEntityThumbnails } })

    const { result, rerender } = renderHook(({ ids }) => useEntityThumbnails('tag', ids), {
      initialProps: { ids: ['t1', 't2'] }
    })

    await waitFor(() => expect(result.current.has('t2')).toBe(true))
    expect(getEntityThumbnails).toHaveBeenCalledTimes(1)

    // A sort toggle reorders the same set - the join key changes, so the effect
    // re-runs, but nothing is missing and no IPC call may be made.
    act(() => {
      rerender({ ids: ['t2', 't1'] })
    })

    expect(getEntityThumbnails).toHaveBeenCalledTimes(1)
  })
})
