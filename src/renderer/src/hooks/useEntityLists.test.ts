// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { SeriesModel, TagModel } from '@shared/models'
import { useSeries, useTags } from './useEntityLists'

const tags: TagModel[] = [{ id: '1', name: 'landscape' }]
const series: SeriesModel[] = [{ id: 's1', name: 'Wonderland', aliases: [] }]

function setApi(api: unknown): void {
  Object.defineProperty(window, 'api', { value: api, writable: true, configurable: true })
}

beforeEach(() => {
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
