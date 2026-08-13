// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { MediaDuplicateMatch } from '@shared/models'
import { useSimilarMedia } from './useSimilarMedia'

const sampleMatch: MediaDuplicateMatch = {
  media: {
    id: '2',
    name: 'B',
    type: 'image',
    route: '/b.png',
    sfw: true,
    isAiGenerated: false,
    createdAt: 1,
    pendingTagging: false
  },
  distance: 3
}

function setApi(api: unknown): void {
  Object.defineProperty(window, 'api', { value: api, writable: true, configurable: true })
}

beforeEach(() => {
  setApi({ media: { findSimilar: vi.fn().mockResolvedValue({ success: true, data: [sampleMatch] }) } })
})

describe('useSimilarMedia', () => {
  it('fetches and returns similar media for a given id', async () => {
    const { result } = renderHook(() => useSimilarMedia('1'))

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual([sampleMatch])
  })

  it('surfaces an error message on failure', async () => {
    setApi({
      media: {
        findSimilar: vi
          .fn()
          .mockResolvedValue({ success: false, error: { code: 'INTERNAL', message: 'boom' } })
      }
    })

    const { result } = renderHook(() => useSimilarMedia('1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual([])
    expect(result.current.error).toBe('boom')
  })

  it('refetches when the id changes', async () => {
    const findSimilar = vi.fn().mockResolvedValue({ success: true, data: [] })
    setApi({ media: { findSimilar } })

    const { rerender } = renderHook(({ id }) => useSimilarMedia(id), { initialProps: { id: '1' } })
    await waitFor(() => expect(findSimilar).toHaveBeenCalledWith('1'))

    rerender({ id: '2' })
    await waitFor(() => expect(findSimilar).toHaveBeenCalledWith('2'))
  })
})
