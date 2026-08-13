// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { SeriesModel, TagModel } from '@shared/models'
import {
  __resetEntityListCachesForTests,
  useEntityCacheSync,
  useSeries,
  useTags
} from './useEntityLists'

const tags: TagModel[] = [{ id: '1', name: 'landscape', createdAt: 1700000000000 }]
const series: SeriesModel[] = [
  { id: 's1', name: 'Wonderland', aliases: [], createdAt: 1700000000000 }
]

function setApi(api: unknown): void {
  Object.defineProperty(window, 'api', { value: api, writable: true, configurable: true })
}

beforeEach(() => {
  __resetEntityListCachesForTests()
  setApi({ tag: { getAll: vi.fn().mockResolvedValue({ success: true, data: tags }) } })
})

describe('useTags', () => {
  it('loads tags on mount', async () => {
    const { result } = renderHook(() => useTags())

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(tags)
  })

  it('refetch() triggers a new call to the API', async () => {
    const getAll = vi.fn().mockResolvedValue({ success: true, data: tags })
    setApi({ tag: { getAll } })

    const { result } = renderHook(() => useTags())
    await waitFor(() => expect(getAll).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => expect(getAll).toHaveBeenCalledTimes(2))
  })

  it('shares one fetch and one cache across two components using the same hook', async () => {
    const getAll = vi.fn().mockResolvedValue({ success: true, data: [{ id: 't1', name: 'a' }] })
    setApi({ tag: { getAll } })

    const first = renderHook(() => useTags())
    const second = renderHook(() => useTags())

    await waitFor(() => expect(first.result.current.loading).toBe(false))
    await waitFor(() => expect(second.result.current.loading).toBe(false))

    expect(getAll).toHaveBeenCalledTimes(1)
    expect(second.result.current.data).toEqual(first.result.current.data)
  })

  it('refetching from one subscriber updates every other mounted subscriber', async () => {
    const getAll = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: [{ id: 't1', name: 'a' }] })
      .mockResolvedValueOnce({
        success: true,
        data: [
          { id: 't1', name: 'a' },
          { id: 't2', name: 'b' }
        ]
      })
    setApi({ tag: { getAll } })

    const first = renderHook(() => useTags())
    const second = renderHook(() => useTags())
    await waitFor(() => expect(first.result.current.loading).toBe(false))

    act(() => {
      first.result.current.refetch()
    })

    await waitFor(() => expect(second.result.current.data).toHaveLength(2))
    expect(getAll).toHaveBeenCalledTimes(2)
  })
})

describe('useSeries', () => {
  it('loads series on mount', async () => {
    setApi({ series: { getAll: vi.fn().mockResolvedValue({ success: true, data: series }) } })

    const { result } = renderHook(() => useSeries())

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(series)
  })
})

describe('useTags.invalidate', () => {
  it('triggers a new fetch and updates mounted subscribers, like refetch', async () => {
    const getAll = vi.fn().mockResolvedValue({ success: true, data: tags })
    setApi({ tag: { getAll } })

    const { result } = renderHook(() => useTags())
    await waitFor(() => expect(getAll).toHaveBeenCalledTimes(1))

    act(() => {
      useTags.invalidate()
    })

    await waitFor(() => expect(getAll).toHaveBeenCalledTimes(2))
    expect(result.current.data).toEqual(tags)
  })
})

function setApiForCacheSync(onChanged: ReturnType<typeof vi.fn>): {
  tagGetAll: ReturnType<typeof vi.fn>
} {
  const tagGetAll = vi.fn().mockResolvedValue({ success: true, data: tags })
  setApi({
    tag: { getAll: tagGetAll },
    character: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
    series: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
    artist: { getAll: vi.fn().mockResolvedValue({ success: true, data: [] }) },
    entities: { onChanged }
  })
  return { tagGetAll }
}

describe('useEntityCacheSync', () => {
  it('invalidates the cache matching the kinds named in an entities:changed event', async () => {
    let emit: (event: { kinds: string[] }) => void = () => {}
    const onChanged = vi.fn((listener: (event: { kinds: string[] }) => void) => {
      emit = listener
      return () => {}
    })
    const { tagGetAll } = setApiForCacheSync(onChanged)

    renderHook(() => useTags())
    await waitFor(() => expect(tagGetAll).toHaveBeenCalledTimes(1))
    renderHook(() => useEntityCacheSync())

    act(() => emit({ kinds: ['tag'] }))

    await waitFor(() => expect(tagGetAll).toHaveBeenCalledTimes(2))
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    const onChanged = vi.fn().mockReturnValue(unsubscribe)
    setApiForCacheSync(onChanged)

    const { unmount } = renderHook(() => useEntityCacheSync())
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
