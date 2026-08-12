// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAdjacentMedia } from './useAdjacentMedia'
import { resetGallerySession, writeGallerySession } from './useGallerySession'

function setApi(api: unknown): void {
  Object.defineProperty(window, 'api', { value: api, writable: true, configurable: true })
}

beforeEach(() => {
  resetGallerySession()
  setApi({
    media: {
      getOrderedIds: vi.fn().mockResolvedValue({ success: true, data: ['a', 'b', 'c'] })
    }
  })
})

describe('useAdjacentMedia', () => {
  it('resolves the previous and next id for a middle item', async () => {
    const { result } = renderHook(() => useAdjacentMedia('b'))

    await waitFor(() => expect(result.current.nextId).not.toBeNull())

    expect(result.current.previousId).toBe('a')
    expect(result.current.nextId).toBe('c')
  })

  it('resolves index and total alongside previous/next', async () => {
    const { result } = renderHook(() => useAdjacentMedia('b'))

    await waitFor(() => expect(result.current.total).not.toBeNull())

    expect(result.current.index).toBe(1)
    expect(result.current.total).toBe(3)
  })

  it('has no previous id for the first item and no next id for the last', async () => {
    const first = renderHook(() => useAdjacentMedia('a'))
    await waitFor(() => expect(first.result.current.nextId).not.toBeNull())
    expect(first.result.current.previousId).toBeNull()
    expect(first.result.current.nextId).toBe('b')

    const last = renderHook(() => useAdjacentMedia('c'))
    await waitFor(() => expect(last.result.current.previousId).not.toBeNull())
    expect(last.result.current.nextId).toBeNull()
  })

  it('returns null for both ids when the id is not in the ordered list', async () => {
    const { result } = renderHook(() => useAdjacentMedia('missing'))

    await waitFor(() => expect(window.api.media.getOrderedIds).toHaveBeenCalled())

    expect(result.current.previousId).toBeNull()
    expect(result.current.nextId).toBeNull()
  })

  it('returns null for both ids when there is no id', () => {
    const { result } = renderHook(() => useAdjacentMedia(undefined))

    expect(result.current).toEqual({ previousId: null, nextId: null, index: null, total: null })
  })

  it('reuses the persisted gallery session filters/sorting', async () => {
    writeGallerySession({ filters: { sfw: true }, sorting: { prop: 'name' }, page: 0 })
    const getOrderedIds = vi.fn().mockResolvedValue({ success: true, data: ['a'] })
    setApi({ media: { getOrderedIds } })

    renderHook(() => useAdjacentMedia('a'))

    await waitFor(() => expect(getOrderedIds).toHaveBeenCalled())
    expect(getOrderedIds).toHaveBeenCalledWith({ sfw: true }, { prop: 'name' })
  })

  it('falls back to default sorting when there is no gallery session', async () => {
    const getOrderedIds = vi.fn().mockResolvedValue({ success: true, data: ['a'] })
    setApi({ media: { getOrderedIds } })

    renderHook(() => useAdjacentMedia('a'))

    await waitFor(() => expect(getOrderedIds).toHaveBeenCalled())
    expect(getOrderedIds).toHaveBeenCalledWith({}, { prop: 'createdAt', desc: true })
  })

  it('uses the override filters/sorting instead of the gallery session when provided', async () => {
    writeGallerySession({ filters: { sfw: true }, sorting: { prop: 'name' }, page: 0 })
    const getOrderedIds = vi.fn().mockResolvedValue({ success: true, data: ['a'] })
    setApi({ media: { getOrderedIds } })

    renderHook(() =>
      useAdjacentMedia('a', {
        filters: { pendingTagging: true },
        sorting: { prop: 'createdAt', desc: false }
      })
    )

    await waitFor(() => expect(getOrderedIds).toHaveBeenCalled())
    expect(getOrderedIds).toHaveBeenCalledWith(
      { pendingTagging: true },
      { prop: 'createdAt', desc: false }
    )
  })

  it('resolves to null/null when the IPC call fails', async () => {
    setApi({
      media: {
        getOrderedIds: vi
          .fn()
          .mockResolvedValue({ success: false, error: { code: 'INTERNAL', message: 'boom' } })
      }
    })

    const { result } = renderHook(() => useAdjacentMedia('a'))

    await waitFor(() => expect(window.api.media.getOrderedIds).toHaveBeenCalled())
    expect(result.current).toEqual({ previousId: null, nextId: null, index: null, total: null })
  })
})
