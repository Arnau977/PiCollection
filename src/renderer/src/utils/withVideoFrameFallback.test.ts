// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../components/MediaThumb/captureVideoFrame', () => ({
  captureVideoFrame: vi.fn()
}))

const { captureVideoFrame } = await import('../components/MediaThumb/captureVideoFrame')
const { withVideoFrameFallback } = await import('./withVideoFrameFallback')

const noThumbnail = {
  success: false as const,
  error: { code: 'NO_THUMBNAIL', message: 'Could not read that file to tag.' }
}
const cacheThumbnail = vi.fn()

beforeEach(() => {
  vi.mocked(captureVideoFrame).mockReset()
  cacheThumbnail.mockReset().mockResolvedValue({ success: true, data: undefined })
  Object.defineProperty(window, 'api', {
    value: { media: { cacheThumbnail } },
    writable: true,
    configurable: true
  })
})

describe('withVideoFrameFallback', () => {
  it('caches a captured frame and retries once when the OS cannot thumbnail a video', async () => {
    vi.mocked(captureVideoFrame).mockResolvedValue(new Blob(['png']))
    const call = vi
      .fn()
      .mockResolvedValueOnce(noThumbnail)
      .mockResolvedValueOnce({ success: true, data: ['tag'] })

    const result = await withVideoFrameFallback('D:/clip.mp4', 'video', call)

    expect(result).toEqual({ success: true, data: ['tag'] })
    expect(cacheThumbnail).toHaveBeenCalledWith('D:/clip.mp4', expect.any(Uint8Array))
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('leaves images and other errors alone', async () => {
    const call = vi.fn().mockResolvedValue(noThumbnail)

    await withVideoFrameFallback('D:/pic.png', 'image', call)
    await withVideoFrameFallback('D:/clip.mp4', 'video', () =>
      Promise.resolve({ success: false as const, error: { code: 'INTERNAL', message: 'x' } })
    )

    expect(captureVideoFrame).not.toHaveBeenCalled()
    expect(call).toHaveBeenCalledTimes(1)
  })
})
