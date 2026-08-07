// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { SeriesModel, TagModel } from '@shared/models'
import { __resetEntityListCachesForTests, useSeries, useTags } from './useEntityLists'

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
