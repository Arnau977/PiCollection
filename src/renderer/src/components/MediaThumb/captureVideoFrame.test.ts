// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureVideoFrame } from './captureVideoFrame'

function stubVideoElement(overrides: {
  duration?: number
  videoWidth?: number
  videoHeight?: number
}): { currentTimeSets: number[] } {
  const currentTimeSets: number[] = []
  Object.defineProperty(HTMLVideoElement.prototype, 'duration', {
    configurable: true,
    get: () => overrides.duration ?? NaN
  })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    configurable: true,
    get: () => overrides.videoWidth ?? 100
  })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    configurable: true,
    get: () => overrides.videoHeight ?? 100
  })
  Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
    configurable: true,
    set(value: number) {
      currentTimeSets.push(value)
      // jsdom doesn't actually seek, so fire 'seeked' ourselves next tick,
      // mirroring how a real browser reports completion of the seek.
      queueMicrotask(() => this.dispatchEvent(new Event('seeked')))
    },
    get() {
      return 0
    }
  })
  return { currentTimeSets }
}

function stubCanvasSuccess(blob: Blob | null = new Blob(['fake-png'])): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn()
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(blob))
}

beforeEach(() => {
  document.body.innerHTML = ''
  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const el = originalCreateElement(tag as keyof HTMLElementTagNameMap)
    if (tag === 'video') document.body.appendChild(el)
    return el
  }) as typeof document.createElement)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('captureVideoFrame', () => {
  it('seeks to a short offset then captures a frame once seeked', async () => {
    const { currentTimeSets } = stubVideoElement({ duration: 4, videoWidth: 200, videoHeight: 150 })
    stubCanvasSuccess()

    const promise = captureVideoFrame('app://media/clip.mp4')
    const video = document.querySelector('video') as HTMLVideoElement
    video.dispatchEvent(new Event('loadedmetadata'))

    const blob = await promise

    expect(currentTimeSets).toEqual([0.1])
    expect(blob).toBeInstanceOf(Blob)
  })

  it('seeks to half the duration when duration is shorter than the default offset', async () => {
    const { currentTimeSets } = stubVideoElement({
      duration: 0.1,
      videoWidth: 200,
      videoHeight: 150
    })
    stubCanvasSuccess()

    const promise = captureVideoFrame('app://media/clip.mp4')
    const video = document.querySelector('video') as HTMLVideoElement
    video.dispatchEvent(new Event('loadedmetadata'))
    await promise

    expect(currentTimeSets).toEqual([0.05])
  })

  it('falls back to loadeddata when duration is not yet known', async () => {
    stubVideoElement({ duration: NaN, videoWidth: 200, videoHeight: 150 })
    stubCanvasSuccess()

    const promise = captureVideoFrame('app://media/clip.mp4')
    const video = document.querySelector('video') as HTMLVideoElement
    video.dispatchEvent(new Event('loadedmetadata'))
    video.dispatchEvent(new Event('loadeddata'))

    const blob = await promise

    expect(blob).toBeInstanceOf(Blob)
  })

  it('resolves null when the video fails to load', async () => {
    stubVideoElement({})

    const promise = captureVideoFrame('app://media/broken.mp4')
    const video = document.querySelector('video') as HTMLVideoElement
    video.dispatchEvent(new Event('error'))

    expect(await promise).toBeNull()
  })

  it('resolves null when the canvas has no 2d context available', async () => {
    stubVideoElement({ duration: 1, videoWidth: 200, videoHeight: 150 })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    const promise = captureVideoFrame('app://media/clip.mp4')
    const video = document.querySelector('video') as HTMLVideoElement
    video.dispatchEvent(new Event('loadedmetadata'))

    expect(await promise).toBeNull()
  })

  it('resolves null when the video has no usable dimensions', async () => {
    stubVideoElement({ duration: 1, videoWidth: 0, videoHeight: 0 })
    stubCanvasSuccess()

    const promise = captureVideoFrame('app://media/clip.mp4')
    const video = document.querySelector('video') as HTMLVideoElement
    video.dispatchEvent(new Event('loadedmetadata'))

    expect(await promise).toBeNull()
  })

  it('resolves null when canvas.toBlob produces no blob', async () => {
    stubVideoElement({ duration: 1, videoWidth: 200, videoHeight: 150 })
    stubCanvasSuccess(null)

    const promise = captureVideoFrame('app://media/clip.mp4')
    const video = document.querySelector('video') as HTMLVideoElement
    video.dispatchEvent(new Event('loadedmetadata'))

    expect(await promise).toBeNull()
  })

  it('resolves null if nothing happens before the timeout', async () => {
    vi.useFakeTimers()
    stubVideoElement({})

    const promise = captureVideoFrame('app://media/hangs.mp4')
    await vi.advanceTimersByTimeAsync(9000)

    expect(await promise).toBeNull()
  })
})
