import { createHash } from 'crypto'

/**
 * Cache entries are keyed by path plus the file's size and mtime, so replacing a
 * file on disk naturally produces a new key instead of serving a stale preview.
 */
export function thumbnailCacheKey(
  filePath: string,
  mtimeMs: number,
  size: number,
  maxSize: number
): string {
  return createHash('sha1')
    .update(`${filePath}|${Math.round(mtimeMs)}|${size}|${maxSize}`)
    .digest('hex')
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.avif'])

/**
 * Whether serving the original file is a sane fallback when no thumbnail could
 * be produced. It is for static images (the browser can scale them itself), but
 * not for videos - piping a whole video into an `<img>` would just fail slowly -
 * and not for GIFs either: the original would animate immediately in an `<img>`,
 * defeating the hover-to-play gallery behavior. GIFs without a cached thumbnail
 * fall back to the placeholder icon instead.
 */
export function canFallBackToOriginal(extension: string): boolean {
  return IMAGE_EXTENSIONS.has(extension.toLowerCase())
}
