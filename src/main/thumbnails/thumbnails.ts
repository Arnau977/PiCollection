import { app, nativeImage, type NativeImage } from 'electron'
import { promises as fs } from 'fs'
import { extname, join, normalize } from 'path'
import { thumbnailCacheKey } from './thumbnailCache'
import { decodeFirstGifFrame } from './gifFirstFrame'

/** Large enough for a 2x gallery card, small enough to decode instantly. */
export const THUMBNAIL_MAX_SIZE = 480

const CACHE_DIR = 'thumbnails'

/** De-duplicates concurrent requests for the same thumbnail (a grid asks for many at once). */
const inFlight = new Map<string, Promise<string | null>>()

function cacheDir(): string {
  return join(app.getPath('userData'), CACHE_DIR)
}

function resizeToFit(image: NativeImage, maxSize: number): NativeImage {
  const { width, height } = image.getSize()
  if (width === 0 || height === 0) return image
  const scale = Math.min(1, maxSize / Math.max(width, height))
  if (scale === 1) return image
  // `resize()` distorts the image if both dimensions are given, so compute
  // both from a single scale factor to preserve the aspect ratio ourselves.
  return image.resize({ width: Math.round(width * scale), height: Math.round(height * scale) })
}

async function loadThumbnailSource(filePath: string, maxSize: number): Promise<NativeImage | null> {
  try {
    // Uses the OS thumbnail providers, so videos get a real poster frame too.
    const shellThumbnail = await nativeImage.createThumbnailFromPath(filePath, {
      width: maxSize,
      height: maxSize
    })
    if (!shellThumbnail.isEmpty()) return shellThumbnail
  } catch {
    // The shell thumbnail provider isn't guaranteed for every format/platform
    // (observed failing for some GIFs) - fall through to the decoder below.
  }

  // Chromium's own image decoder: no OS shell dependency, and since a
  // NativeImage only ever holds a single bitmap, an animated GIF safely
  // yields just its first frame. Doesn't work for videos.
  const decoded = nativeImage.createFromPath(filePath)
  if (!decoded.isEmpty()) return resizeToFit(decoded, maxSize)

  // Last resort for GIFs: Chromium's decoder above loads every frame of the
  // animation to support playback, so a large/many-frame GIF can get rejected
  // outright (observed: a 720x720, ~300-frame, 7.8MB GIF failed both this and
  // the shell thumbnail above). Reading just the first frame ourselves costs
  // the same regardless of how many frames or how large the file is.
  if (extname(filePath).toLowerCase() === '.gif') {
    try {
      const buf = await fs.readFile(filePath)
      const frame = decodeFirstGifFrame(buf)
      if (frame) {
        const bitmap = nativeImage.createFromBitmap(frame.bgra, {
          width: frame.width,
          height: frame.height
        })
        if (!bitmap.isEmpty()) return resizeToFit(bitmap, maxSize)
      }
    } catch {
      // Fall through to null below.
    }
  }

  return null
}

async function generate(
  filePath: string,
  maxSize: number,
  targetPath: string
): Promise<string | null> {
  try {
    const image = await loadThumbnailSource(filePath, maxSize)
    if (!image) return null

    await fs.mkdir(cacheDir(), { recursive: true })
    await fs.writeFile(targetPath, image.toPNG())
    return targetPath
  } catch {
    return null
  }
}

/**
 * Where a thumbnail for `filePath` at `maxSize` would be cached, computed the
 * same way `resolveThumbnail` does, so a frame cached via `cacheThumbnailFromBuffer`
 * is found by a later `resolveThumbnail` call for the same file.
 */
async function targetPathFor(filePath: string, maxSize: number): Promise<string | null> {
  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    stat = await fs.stat(filePath)
  } catch {
    return null
  }
  const key = thumbnailCacheKey(filePath, stat.mtimeMs, stat.size, maxSize)
  return join(cacheDir(), `${key}.png`)
}

/**
 * Returns the path to a cached thumbnail for `filePath`, generating it on first
 * use. Returns null when no thumbnail could be produced, leaving it to the
 * caller to decide how to degrade.
 */
export async function resolveThumbnail(
  requestedPath: string,
  maxSize: number = THUMBNAIL_MAX_SIZE
): Promise<string | null> {
  // Paths arrive from `app://` URLs with forward slashes. `fs` tolerates those on
  // Windows but the shell thumbnail provider does not ("Failed to create
  // IShellItem"), so normalize before doing anything - it also keeps the cache
  // key stable no matter which slash style the caller used.
  const filePath = normalize(requestedPath)

  const targetPath = await targetPathFor(filePath, maxSize)
  if (!targetPath) return null

  try {
    await fs.access(targetPath)
    return targetPath
  } catch {
    // Not cached yet - fall through and generate it.
  }

  const pending = inFlight.get(targetPath)
  if (pending) return pending

  const work = generate(filePath, maxSize, targetPath).finally(() => inFlight.delete(targetPath))
  inFlight.set(targetPath, work)
  return work
}

/**
 * Persists a thumbnail produced elsewhere (the renderer captures a video
 * frame via a real `<video>` element when the OS can't produce one - see
 * `MediaThumb`'s capture fallback) into the same cache `resolveThumbnail`
 * reads from, so it doesn't need re-capturing on every load.
 */
export async function cacheThumbnailFromBuffer(
  requestedPath: string,
  maxSize: number,
  pngBuffer: Buffer
): Promise<void> {
  const filePath = normalize(requestedPath)
  const targetPath = await targetPathFor(filePath, maxSize)
  if (!targetPath) return

  // The renderer captures at the video's native resolution, which can be far
  // larger than a thumbnail needs (a 4K video would otherwise cache a 4K
  // "preview"), so cap it here the same way every other source is capped.
  const image = nativeImage.createFromBuffer(pngBuffer)
  const capped = image.isEmpty() ? pngBuffer : resizeToFit(image, maxSize).toPNG()

  await fs.mkdir(cacheDir(), { recursive: true })
  await fs.writeFile(targetPath, capped)
}
