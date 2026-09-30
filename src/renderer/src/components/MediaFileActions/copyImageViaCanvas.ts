/**
 * Copies an image to the clipboard as a PNG decoded by Chromium - the
 * fallback for files Electron's `nativeImage` can't read (WebP, animated WebP,
 * AVIF). An animated file copies its first frame, like a GIF does.
 * crossOrigin so the canvas can be read back (the app: scheme is CORS-enabled).
 */
export async function copyImageViaCanvas(src: string): Promise<boolean> {
  async function toPng(): Promise<Blob> {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = src
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    canvas.getContext('2d')?.drawImage(image, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not encode the image.')
    return blob
  }

  try {
    // The blob goes in as a promise so the write starts right away, while
    // the click still counts as the user's gesture.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': toPng() })])
    return true
  } catch {
    return false
  }
}
