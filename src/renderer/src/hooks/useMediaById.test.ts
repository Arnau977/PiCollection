// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { MediaModel } from '@shared/models'
import { useMediaById } from './useMediaById'

const sampleMedia: MediaModel = {
  id: '1',
  name: 'A',
  type: 'image',
  route: '/a.png',
  sfw: true,
  isAiGenerated: false,
  createdAt: 1,
  pendingTagging: false
}

function setApi(api: unknown): void {
  Object.defineProperty(window, 'api', { value: api, writable: true, configurable: true })
}

beforeEach(() => {
  setApi({ media: { getById: vi.fn().mockResolvedValue({ success: true, data: sampleMedia }) } })
})

describe('useMediaById', () => {
  it('returns null without fetching when id is undefined', async () => {
    const getById = vi.fn()
    setApi({ media: { getById } })

    const { result } = renderHook(() => useMediaById(undefined))

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(getById).not.toHaveBeenCalled()
  })

  it('fetches and returns the media for a given id', async () => {
    const { result } = renderHook(() => useMediaById('1'))

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toEqual(sampleMedia)
  })

  it('surfaces an error message when the media is not found', async () => {
    setApi({
      media: {
        getById: vi
          .fn()
          .mockResolvedValue({ success: false, error: { code: 'INTERNAL', message: 'not found' } })
      }
    })

    const { result } = renderHook(() => useMediaById('missing'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('not found')
  })
})
