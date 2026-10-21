/** What a host can ask a player for: the frame it's showing right now. */
export interface VideoFrameSource {
  /**
   * The frame on screen as a PNG, scaled to fit `maxSize` if given. Null
   * while the video is still at its very start (nothing picked yet) or
   * can't be read.
   */
  captureShownFrame: (maxSize?: number) => Promise<Blob | null>
}

/**
 * Draws the frame a <video> shows now onto a canvas. The element needs
 * crossOrigin set, or the canvas is tainted and can't be read back (the app:
 * scheme is CORS-enabled).
 */
export function drawVideoFrame(video: HTMLVideoElement, maxSize?: number): Promise<Blob | null> {
  const { videoWidth, videoHeight } = video
  if (videoWidth === 0 || videoHeight === 0) return Promise.resolve(null)
  const scale = maxSize ? Math.min(1, maxSize / Math.max(videoWidth, videoHeight)) : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(videoWidth * scale)
  canvas.height = Math.round(videoHeight * scale)
  try {
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
  } catch {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/** Copies the frame on screen, at full size, to the clipboard as a PNG. */
export async function copyVideoFrame(video: HTMLVideoElement): Promise<boolean> {
  try {
    // The blob goes in as a promise so the write starts while the click
    // still counts as the user's gesture (as in copyImageViaCanvas).
    const png = drawVideoFrame(video).then((blob) => {
      if (!blob) throw new Error('Could not read the frame.')
      return blob
    })
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    return true
  } catch {
    return false
  }
}
