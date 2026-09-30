import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import sharp from 'sharp'
import { resolveThumbnail } from '../thumbnails/thumbnails'

// sharp's operation cache keeps input files open, which on Windows would
// lock them (e.g. against moving to the Recycle Bin); hashing gains nothing from it.
sharp.cache(false)

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

/** What near-duplicate detection compares: a perceptual hash and the picture's shape. */
export interface VisualFingerprint {
  /** 64-bit DCT perceptual hash, 16 hex chars. */
  phash: string
  /** Width / height, after EXIF rotation. */
  aspectRatio: number
}

/**
 * 64-bit DCT perceptual hash (pHash) of the file's visual content, plus its
 * aspect ratio. The file itself is decoded with sharp (JPEG/PNG/WebP/AVIF,
 * a GIF's or animated WebP's first frame); what sharp can't read (a video)
 * falls back to its cached thumbnail.
 *
 * The picture is squashed to 32x32 grayscale, and each of the 64 lowest DCT
 * frequencies (8x8) becomes a bit: above or below their median. Unlike the
 * earlier 9x8 difference hash, flat areas (a white background) don't turn
 * into runs of zeros, so two unrelated pictures on similar backgrounds no
 * longer look alike. Returns null when nothing could be decoded.
 */
export async function computePerceptualHash(filePath: string): Promise<VisualFingerprint | null> {
  const fromFile = await fingerprintOf(filePath)
  if (fromFile) return fromFile
  const thumbPath = await resolveThumbnail(filePath)
  return thumbPath ? fingerprintOf(thumbPath) : null
}

async function fingerprintOf(input: string): Promise<VisualFingerprint | null> {
  try {
    const metadata = await sharp(input).metadata()
    if (!metadata.width || !metadata.height) return null
    // EXIF orientations 5-8 swap width and height once rotated.
    const rotated = (metadata.orientation ?? 1) >= 5
    const aspectRatio = rotated
      ? metadata.height / metadata.width
      : metadata.width / metadata.height

    const { data } = await sharp(input)
      .rotate()
      .resize(DCT_SIZE, DCT_SIZE, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
    return { phash: dctHash(data), aspectRatio }
  } catch {
    return null
  }
}

const DCT_SIZE = 32
const HASH_SIZE = 8
const COSINES = Array.from({ length: HASH_SIZE }, (_, k) =>
  Array.from({ length: DCT_SIZE }, (_, n) => Math.cos(((2 * n + 1) * k * Math.PI) / (2 * DCT_SIZE)))
)

/** 32x32 grayscale bytes -> 16 hex chars. */
export function dctHash(pixels: Uint8Array): string {
  const coefficients: number[] = []
  for (let u = 0; u < HASH_SIZE; u += 1) {
    for (let v = 0; v < HASH_SIZE; v += 1) {
      let sum = 0
      for (let y = 0; y < DCT_SIZE; y += 1) {
        for (let x = 0; x < DCT_SIZE; x += 1) {
          sum += pixels[y * DCT_SIZE + x] * COSINES[u][y] * COSINES[v][x]
        }
      }
      coefficients.push(sum)
    }
  }
  // The DC term (overall brightness) is left out of the median.
  const ac = coefficients.slice(1).sort((a, b) => a - b)
  const median = ac[Math.floor(ac.length / 2)]

  let hex = ''
  for (let i = 0; i < coefficients.length; i += 4) {
    let nibble = 0
    for (let bit = 0; bit < 4; bit += 1) {
      nibble = (nibble << 1) | (coefficients[i + bit] > median ? 1 : 0)
    }
    hex += nibble.toString(16)
  }
  return hex
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

/**
 * Out of 64 bits. Tuned on a real ~1000-picture library: up to 12 still
 * catches recompressions, resizes and a post's near-identical pages, and past
 * it unrelated pictures start to show up.
 */
export const PHASH_SIMILAR_THRESHOLD = 12

/**
 * Copies keep their shape: two pictures whose aspect ratios differ by more
 * than ~3% aren't the same picture, however close their hashes (the hash
 * squashes both into a square). 0 means "unknown" and doesn't filter.
 */
export function sameShape(ratioA: number | null, ratioB: number | null): boolean {
  if (!ratioA || !ratioB) return true
  return Math.abs(Math.log(ratioA / ratioB)) <= 0.03
}
