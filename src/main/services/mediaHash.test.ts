import { createHash } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const createThumbnailFromPath = vi.fn()
const createFromPath = vi.fn()
const createFromBitmap = vi.fn()
const createFromBuffer = vi.fn()
let userDataDir = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
  nativeImage: {
    createThumbnailFromPath: (...args: unknown[]) => createThumbnailFromPath(...args),
    createFromPath: (...args: unknown[]) => createFromPath(...args),
    createFromBitmap: (...args: unknown[]) => createFromBitmap(...args),
    createFromBuffer: (...args: unknown[]) => createFromBuffer(...args)
  }
}))

const { computeFileHash, computePerceptualHash, hammingDistance } = await import('./mediaHash')

/** Fake NativeImage returned by the shell thumbnail provider - always succeeds. */
function fakeThumbnail(): unknown {
  return {
    isEmpty: () => false,
    getSize: () => ({ width: 480, height: 480 }),
    resize: () => fakeThumbnail(),
    toPNG: () => Buffer.from('fake-png-bytes')
  }
}

function emptyImage(): unknown {
  return { isEmpty: () => true }
}

/** BGRA buffer, brightness only a function of `x` so every row's dHash bits are identical. */
function gradientBitmap(
  width: number,
  height: number,
  brightnessAt: (x: number) => number
): Buffer {
  const buf = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4
      const v = brightnessAt(x)
      buf[o] = v
      buf[o + 1] = v
      buf[o + 2] = v
      buf[o + 3] = 255
    }
  }
  return buf
}

function fakeDecodedImage(bitmap: Buffer, width: number, height: number): unknown {
  return {
    isEmpty: () => false,
    getSize: () => ({ width, height }),
    resize: () => fakeDecodedImage(bitmap, width, height),
    toBitmap: () => bitmap
  }
}

let sourceDir = ''

beforeEach(async () => {
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'media-hash-src-'))
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'media-hash-cache-'))
  createThumbnailFromPath.mockReset().mockResolvedValue(fakeThumbnail())
  createFromPath.mockReset().mockReturnValue(emptyImage())
  createFromBitmap.mockReset().mockReturnValue(emptyImage())
  createFromBuffer.mockReset().mockReturnValue(emptyImage())
})

afterEach(async () => {
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

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
  it('returns null when no thumbnail can be produced', async () => {
    const file = join(sourceDir, 'not-an-image.txt')
    await fs.writeFile(file, 'not actually an image')
    createThumbnailFromPath.mockRejectedValue(new Error('unsupported'))
    createFromPath.mockReturnValue(emptyImage())

    expect(await computePerceptualHash(file)).toBeNull()
  })

  it('returns a 16-char hex dHash for a decodable thumbnail', async () => {
    const file = join(sourceDir, 'pic.png')
    await fs.writeFile(file, 'x')
    const ascending = gradientBitmap(9, 8, (x) => x * 20)
    createFromPath.mockReturnValue(fakeDecodedImage(ascending, 9, 8))

    const hash = await computePerceptualHash(file)
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
    // Strictly ascending brightness -> every pixel is dimmer than its right
    // neighbor, so every "brighter than the right neighbor" bit is 0.
    expect(hash).toBe('0'.repeat(16))
  })

  it('produces the inverse hash for a descending gradient', async () => {
    const file = join(sourceDir, 'pic2.png')
    await fs.writeFile(file, 'x')
    const descending = gradientBitmap(9, 8, (x) => 160 - x * 20)
    createFromPath.mockReturnValue(fakeDecodedImage(descending, 9, 8))

    expect(await computePerceptualHash(file)).toBe('f'.repeat(16))
  })
})

describe('hammingDistance', () => {
  it('is 0 for identical hashes', () => {
    expect(hammingDistance('0123abcd', '0123abcd')).toBe(0)
  })

  it('counts every differing bit', () => {
    expect(hammingDistance('0'.repeat(16), 'f'.repeat(16))).toBe(64)
  })

  it('is infinite for mismatched lengths', () => {
    expect(hammingDistance('00', '000')).toBe(Number.POSITIVE_INFINITY)
  })
})
