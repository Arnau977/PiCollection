import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { nativeImage } from 'electron'
import { resolveThumbnail } from '../thumbnails/thumbnails'

/** 9x8 so each row yields 8 horizontal comparisons - 64 bits total, 16 hex chars. */
const PHASH_WIDTH = 9
const PHASH_HEIGHT = 8

const NIBBLE_POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]

/**
 * SHA-256 of a file's raw bytes, streamed so large videos don't need to be
 * buffered in memory. Returns null instead of throwing when the file can't
 * be read (moved/deleted/permission issue) - duplicate detection then simply
 * skips that file rather than blocking the caller.
 */
export function computeFileHash(filePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('error', () => resolve(null))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/**
 * 64-bit difference hash (dHash) of the file's visual content: reuses the
 * same thumbnail already generated/cached for the gallery and SauceNAO
 * (handles images, video posterframes and GIF first frames uniformly),
 * resizes it to 9x8 and encodes whether each pixel is brighter than its
 * right neighbor. Two hashes' Hamming distance approximates visual
 * similarity, tolerant to recompression/resizing - unlike `computeFileHash`,
 * which only matches byte-identical files.
 */
export async function computePerceptualHash(filePath: string): Promise<string | null> {
  const thumbPath = await resolveThumbnail(filePath)
  if (!thumbPath) return null

  try {
    const image = nativeImage.createFromPath(thumbPath)
    if (image.isEmpty()) return null

    const resized = image.resize({ width: PHASH_WIDTH, height: PHASH_HEIGHT })
    const { width, height } = resized.getSize()
    if (width !== PHASH_WIDTH || height !== PHASH_HEIGHT) return null

    // BGRA, 4 bytes per pixel - a plain average of the 3 color channels is a
    // good enough luma approximation for a difference hash.
    const bitmap = resized.toBitmap()
    const gray = new Array<number>(width * height)
    for (let i = 0; i < gray.length; i += 1) {
      const o = i * 4
      gray[i] = (bitmap[o] + bitmap[o + 1] + bitmap[o + 2]) / 3
    }

    let bits = ''
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width - 1; x += 1) {
        bits += gray[y * width + x] > gray[y * width + x + 1] ? '1' : '0'
      }
    }

    let hex = ''
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
    }
    return hex
  } catch {
    return null
  }
}

/** Number of differing bits between two same-length hex hashes; Infinity if the lengths don't match. */
export function hammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) return Number.POSITIVE_INFINITY
  let distance = 0
  for (let i = 0; i < hashA.length; i += 1) {
    const xor = parseInt(hashA[i], 16) ^ parseInt(hashB[i], 16)
    distance += NIBBLE_POPCOUNT[xor]
  }
  return distance
}

/** Out of 64 bits - conservative enough to flag recompressions/resizes without too many false positives. */
export const PHASH_SIMILAR_THRESHOLD = 10
