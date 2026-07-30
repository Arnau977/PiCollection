const CAPTURE_TIMEOUT_MS = 8000

/**
 * Captures a still frame from a video via a real `<video>` element, for videos
 * whose OS-generated thumbnail failed (some containers/codecs the shell
 * thumbnail provider rejects play back in Chromium just fine - this is why
 * hover-to-play already works for them). Returns null if the video can't be
 * decoded either, or nothing renders within the timeout.
 */
export function captureVideoFrame(src: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    let settled = false
    const finish = (result: Blob | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // Releases the decoder eagerly instead of waiting for GC.
      video.removeAttribute('src')
      video.load()
      resolve(result)
    }

    const timer = setTimeout(() => finish(null), CAPTURE_TIMEOUT_MS)

    function draw(): void {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx || canvas.width === 0 || canvas.height === 0) {
          finish(null)
          return
        }
        ctx.drawImage(video, 0, 0)
        canvas.toBlob((blob) => finish(blob), 'image/png')
      } catch {
        finish(null)
      }
    }

    let seeking = false
    video.addEventListener('loadedmetadata', () => {
      const duration = video.duration
      // A short offset avoids an all-black/blank first frame, common in clips
      // transcoded from GIFs or with a fade-in. Falls through to 'loadeddata'
      // below when duration isn't known yet.
      if (Number.isFinite(duration) && duration > 0) {
        seeking = true
        video.currentTime = Math.min(0.1, duration / 2)
      }
    })
    video.addEventListener('seeked', draw)
    video.addEventListener('loadeddata', () => {
      if (!seeking) draw()
    })
    video.addEventListener('error', () => finish(null))

    video.src = src
  })
}
