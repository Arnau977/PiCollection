// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { MediaModel } from '@shared/models'
import { useMediaQuery } from './useMediaQuery'

const media: MediaModel[] = [
  {
    id: '1',
    name: 'A',
    type: 'image',
    route: '/a.png',
    sfw: true,
    isAiGenerated: false,
    createdAt: 1
  }
]

function setApi(api: unknown): void {
  Object.defineProperty(window, 'api', { value: api, writable: true, configurable: true })
}

beforeEach(() => {
  setApi({
    media: {
      getFiltered: vi.fn().mockResolvedValue({ success: true, data: { items: media, total: 1 } })
    }
  })
})

describe('useMediaQuery', () => {
  it('starts in a loading state and resolves with the fetched media and total', async () => {
    const stableFilters = {}
    const { result } = renderHook(() => useMediaQuery(stableFilters))

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual(media)
    expect(result.current.total).toBe(1)
    expect(result.current.error).toBeNull()
  })

  it('surfaces the error message when the IPC call reports failure', async () => {
    setApi({
      media: {
        getFiltered: vi
          .fn()
          .mockResolvedValue({ success: false, error: { code: 'INTERNAL', message: 'boom' } })
      }
    })

    const stableFilters = {}
    const { result } = renderHook(() => useMediaQuery(stableFilters))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.error).toBe('boom')
  })

  it('re-fetches when filters change', async () => {
    const getFiltered = vi
      .fn()
      .mockResolvedValue({ success: true, data: { items: media, total: 1 } })
    setApi({ media: { getFiltered } })

    const { rerender } = renderHook(({ filters }) => useMediaQuery(filters), {
      initialProps: { filters: { query: 'a' } }
    })

    await waitFor(() => expect(getFiltered).toHaveBeenCalledTimes(1))

    rerender({ filters: { query: 'b' } })

    await waitFor(() => expect(getFiltered).toHaveBeenCalledTimes(2))
    expect(getFiltered).toHaveBeenLastCalledWith({ query: 'b' }, undefined)
  })
})
