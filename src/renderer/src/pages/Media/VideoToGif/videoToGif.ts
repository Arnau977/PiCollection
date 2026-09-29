import { MIN_WIDTH, SHRINK_FACTOR, type GifSettings } from './gifPresets'
import type { GifWorkerRequest, GifWorkerResponse } from './gifEncoder.worker'

export interface Clip {
  start: number
  end: number
}

export interface GifProgress {
  /** Frames encoded so far in this attempt, out of `total`. */
  done: number
  total: number
  width: number
  /** 1 for the first try; higher when re-encoding smaller to fit a size limit. */
  attempt: number
  /** Size of the previous attempt that was over the limit, in bytes. */
  previousBytes?: number
}

export interface GifResult {
  bytes: Uint8Array
  width: number
  height: number
}

function abortError(): DOMException {
  return new DOMException('Cancelled', 'AbortError')
}

function once(target: EventTarget, event: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }
    const onAbort = (): void => reject(abortError())
    target.addEventListener(
      event,
      () => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      },
      { once: true }
    )
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** crossOrigin so the canvas it's drawn onto can be read back (the app: scheme is CORS-enabled). */
async function loadVideo(src: string, signal: AbortSignal): Promise<HTMLVideoElement> {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.preload = 'auto'
  const failed = new Promise<never>((_, reject) =>
    video.addEventListener('error', () => reject(new Error('video-unreadable')), { once: true })
  )
  video.src = src
  await Promise.race([once(video, 'loadeddata', signal), failed])
  return video
}

async function seek(video: HTMLVideoElement, time: number, signal: AbortSignal): Promise<void> {
  const seeked = once(video, 'seeked', signal)
  video.currentTime = time
  await seeked
}

function nextMessage(worker: Worker, signal: AbortSignal): Promise<GifWorkerResponse> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => reject(abortError())
    worker.addEventListener(
      'message',
      (event: MessageEvent<GifWorkerResponse>) => {
        signal.removeEventListener('abort', onAbort)
        resolve(event.data)
      },
      { once: true }
    )
    worker.addEventListener('error', () => reject(new Error('encoder-failed')), { once: true })
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function encodeOnce(
  video: HTMLVideoElement,
  clip: Clip,
  width: number,
  fps: number,
  onFrame: (done: number, total: number) => void,
  signal: AbortSignal
): Promise<GifResult> {
  const height = Math.max(1, Math.round((width * video.videoHeight) / video.videoWidth))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('encoder-failed')

  const total = Math.max(1, Math.round((clip.end - clip.start) * fps))
  const delay = Math.round(1000 / fps)
  const worker = new Worker(new URL('./gifEncoder.worker.ts', import.meta.url), {
    type: 'module'
  })
  const post = (message: GifWorkerRequest, transfer: Transferable[] = []): void =>
    worker.postMessage(message, transfer)

  try {
    for (let i = 0; i < total; i++) {
      await seek(video, clip.start + i / fps, signal)
      ctx.drawImage(video, 0, 0, width, height)
      const { data } = ctx.getImageData(0, 0, width, height)
      const encoded = nextMessage(worker, signal)
      post({ type: 'frame', rgba: data, width, height, delay }, [data.buffer])
      await encoded
      onFrame(i + 1, total)
    }
    const finished = nextMessage(worker, signal)
    post({ type: 'finish' })
    const result = await finished
    if (result.type !== 'done') throw new Error('encoder-failed')
    return { bytes: result.bytes, width, height }
  } finally {
    worker.terminate()
  }
}

/**
 * Turns a clip of a video into an animated GIF, entirely in the renderer:
 * frames are grabbed by seeking a <video> and drawing it to a canvas, and a
 * worker encodes them. With a size limit, a result that's too big is
 * re-encoded narrower until it fits (or can't shrink any further). Never
 * upscales past the video's own width.
 */
export async function convertVideoToGif(
  src: string,
  clip: Clip,
  settings: GifSettings,
  onProgress: (progress: GifProgress) => void,
  signal: AbortSignal
): Promise<GifResult> {
  const video = await loadVideo(src, signal)
  try {
    let width = Math.min(settings.width, video.videoWidth)
    let attempt = 1
    let previousBytes: number | undefined
    for (;;) {
      const report = (done: number, total: number): void =>
        onProgress({ done, total, width, attempt, previousBytes })
      report(0, 1)
      const result = await encodeOnce(video, clip, width, settings.fps, report, signal)
      const tooBig = settings.maxBytes !== undefined && result.bytes.length > settings.maxBytes
      const nextWidth = Math.round(width * SHRINK_FACTOR)
      if (!tooBig || nextWidth < MIN_WIDTH) return result
      previousBytes = result.bytes.length
      width = nextWidth
      attempt++
    }
  } finally {
    // Releases the decoder right away instead of waiting for GC.
    video.removeAttribute('src')
    video.load()
  }
}
