import { createHash } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import sharp from 'sharp'

const resolveThumbnail = vi.fn()
vi.mock('../thumbnails/thumbnails', () => ({
  resolveThumbnail: (...args: unknown[]) => resolveThumbnail(...args)
}))

const { computeFileHash, computePerceptualHash, hammingDistance, sameShape } = await import(
  './mediaHash'
)

let sourceDir = ''

beforeEach(async () => {
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'media-hash-src-'))
  resolveThumbnail.mockReset().mockResolvedValue(null)
})

afterEach(async () => {
  await fs.rm(sourceDir, { recursive: true, force: true })
})

/** A white 300x400 canvas with dark shapes on it, like a figure on a plain background. */
function figure(shapes: string): sharp.Sharp {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400">
    <rect width="300" height="400" fill="#fff"/>${shapes}</svg>`
  return sharp(Buffer.from(svg))
}
// Off-center like a real illustration: a perfectly symmetric shape leaves
// many DCT terms at exactly zero, right on the median, where noise flips them.
const STANDING =
  '<rect x="95" y="70" width="55" height="310" fill="#222"/>' +
  '<circle cx="130" cy="55" r="32" fill="#c33"/><rect x="190" y="240" width="70" height="40" fill="#36c"/>'
const SITTING =
  '<ellipse cx="90" cy="300" rx="80" ry="60" fill="#222"/>' +
  '<circle cx="220" cy="120" r="50" fill="#36c"/>'

describe('computeFileHash', () => {
  it('matches a manually computed SHA-256 of the file contents', async () => {
    const file = join(sourceDir, 'a.txt')
    await fs.writeFile(file, 'hello world')
    const expected = createHash('sha256').update('hello world').digest('hex')
    expect(await computeFileHash(file)).toBe(expected)
  })

  it('returns null for a file that does not exist', async () => {
    expect(await computeFileHash(join(sourceDir, 'missing.txt'))).toBeNull()
  })
})

describe('computePerceptualHash', () => {
  it('matches the same picture across PNG, WebP and a smaller JPEG', async () => {
    const png = join(sourceDir, 'pic.png')
    const webp = join(sourceDir, 'pic.webp')
    const jpeg = join(sourceDir, 'small.jpg')
    await figure(STANDING).png().toFile(png)
    await figure(STANDING).webp({ quality: 70 }).toFile(webp)
    await figure(STANDING).resize(150).jpeg({ quality: 60 }).toFile(jpeg)

    const [a, b, c] = await Promise.all([png, webp, jpeg].map(computePerceptualHash))

    expect(a?.phash).toMatch(/^[0-9a-f]{16}$/)
    expect(a?.aspectRatio).toBeCloseTo(0.75)
    expect(hammingDistance(a!.phash, b!.phash)).toBeLessThanOrEqual(4)
    expect(hammingDistance(a!.phash, c!.phash)).toBeLessThanOrEqual(4)
    expect(sameShape(a!.aspectRatio, c!.aspectRatio)).toBe(true)
  })

  // The old 9x8 difference hash saw two figures on white as near-identical.
  it('keeps two different figures on the same white background apart', async () => {
    const standing = join(sourceDir, 'standing.png')
    const sitting = join(sourceDir, 'sitting.png')
    await figure(STANDING).png().toFile(standing)
    await figure(SITTING).png().toFile(sitting)

    const [a, b] = await Promise.all([standing, sitting].map(computePerceptualHash))

    expect(hammingDistance(a!.phash, b!.phash)).toBeGreaterThan(12)
  })

  it('falls back to the thumbnail when the file itself is not an image (a video)', async () => {
    const video = join(sourceDir, 'clip.mp4')
    const thumb = join(sourceDir, 'thumb.png')
    await fs.writeFile(video, 'not an image')
    await figure(STANDING).png().toFile(thumb)
    resolveThumbnail.mockResolvedValue(thumb)

    expect((await computePerceptualHash(video))?.aspectRatio).toBeCloseTo(0.75)
  })

  it('returns null when neither the file nor a thumbnail can be decoded', async () => {
    const file = join(sourceDir, 'not-an-image.txt')
    await fs.writeFile(file, 'not actually an image')

    expect(await computePerceptualHash(file)).toBeNull()
  })
})

describe('hammingDistance', () => {
  it('counts every differing bit', () => {
    expect(hammingDistance('0123abcd', '0123abcd')).toBe(0)
    expect(hammingDistance('0'.repeat(16), 'f'.repeat(16))).toBe(64)
  })

  it('is infinite for mismatched lengths', () => {
    expect(hammingDistance('00', '000')).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('sameShape', () => {
  it('tells a portrait from a near-square picture, and ignores unknown ratios', () => {
    expect(sameShape(0.667, 0.827)).toBe(false)
    expect(sameShape(0.7, 0.71)).toBe(true)
    expect(sameShape(0, 1.5)).toBe(true)
  })
})
