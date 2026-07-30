import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join, normalize } from 'path'
import { tmpdir } from 'os'

const createThumbnailFromPath = vi.fn()
const createFromPath = vi.fn()
const createFromBitmap = vi.fn()
const createFromBuffer = vi.fn()
const decodeFirstGifFrame = vi.fn()
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

// The GIF-frame decoder itself is unit-tested in gifFirstFrame.test.ts; here
// we only need to verify thumbnails.ts wires it in as a fallback correctly.
vi.mock('./gifFirstFrame', () => ({
  decodeFirstGifFrame: (...args: unknown[]) => decodeFirstGifFrame(...args)
}))

const { resolveThumbnail, cacheThumbnailFromBuffer, THUMBNAIL_MAX_SIZE } = await import(
  './thumbnails'
)

function fakeImage(size = { width: 100, height: 100 }): unknown {
  return {
    isEmpty: () => false,
    getSize: () => size,
    resize: () => fakeImage(size),
    toPNG: () => Buffer.from('png-bytes')
  }
}

function emptyImage(): unknown {
  return { isEmpty: () => true }
}

let sourceDir = ''

beforeEach(async () => {
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'thumb-src-'))
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'thumb-cache-'))
  createThumbnailFromPath.mockReset()
  createThumbnailFromPath.mockResolvedValue(fakeImage())
  createFromPath.mockReset()
  createFromPath.mockReturnValue(emptyImage())
  createFromBitmap.mockReset()
  createFromBitmap.mockReturnValue(emptyImage())
  createFromBuffer.mockReset()
  createFromBuffer.mockReturnValue(emptyImage())
  decodeFirstGifFrame.mockReset()
  decodeFirstGifFrame.mockReturnValue(null)
})

afterEach(async () => {
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('resolveThumbnail', () => {
  it('normalizes the path before handing it to the OS thumbnail provider', async () => {
    const file = join(sourceDir, 'pic.png')
    await fs.writeFile(file, 'x')
    // `app://` URLs always decode to forward slashes; on Windows the shell
    // thumbnail provider rejects those outright, which used to silently degrade
    // every request to the full-size original.
    const forwardSlashed = file.replace(/\\/g, '/')

    await resolveThumbnail(forwardSlashed)

    expect(createThumbnailFromPath).toHaveBeenCalledWith(normalize(file), expect.anything())
  })

  it('writes the generated thumbnail into the cache and reuses it', async () => {
    const file = join(sourceDir, 'pic.png')
    await fs.writeFile(file, 'x')

    const first = await resolveThumbnail(file)
    const second = await resolveThumbnail(file)

    expect(first).not.toBeNull()
    expect(second).toBe(first)
    expect(await fs.readFile(first as string, 'utf8')).toBe('png-bytes')
    expect(createThumbnailFromPath).toHaveBeenCalledTimes(1)
  })

  it('keys the cache by path so different slash styles share one entry', async () => {
    const file = join(sourceDir, 'pic.png')
    await fs.writeFile(file, 'x')

    const viaBackslash = await resolveThumbnail(file)
    const viaForwardSlash = await resolveThumbnail(file.replace(/\\/g, '/'))

    expect(viaForwardSlash).toBe(viaBackslash)
  })

  it('returns null when the source file does not exist', async () => {
    expect(await resolveThumbnail(join(sourceDir, 'missing.png'))).toBeNull()
    expect(createThumbnailFromPath).not.toHaveBeenCalled()
  })

  it('returns null when neither the shell provider nor the image decoder can produce a thumbnail', async () => {
    const file = join(sourceDir, 'clip.mp4')
    await fs.writeFile(file, 'x')
    createThumbnailFromPath.mockRejectedValue(new Error('unsupported'))

    expect(await resolveThumbnail(file)).toBeNull()
    expect(createFromPath).toHaveBeenCalledWith(normalize(file))
  })

  it('falls back to the Chromium image decoder when the shell thumbnail provider throws', async () => {
    // Reproduces "Failed to create IShellItem from the given path", seen for
    // some GIFs on Windows - the file itself is a perfectly decodable image.
    const file = join(sourceDir, 'clip.gif')
    await fs.writeFile(file, 'x')
    createThumbnailFromPath.mockRejectedValue(new Error('Failed to create IShellItem'))
    createFromPath.mockReturnValue(fakeImage({ width: 800, height: 600 }))

    const result = await resolveThumbnail(file)

    expect(result).not.toBeNull()
    expect(await fs.readFile(result as string, 'utf8')).toBe('png-bytes')
  })

  it('falls back to the Chromium image decoder when the shell thumbnail provider returns empty', async () => {
    const file = join(sourceDir, 'clip.gif')
    await fs.writeFile(file, 'x')
    createThumbnailFromPath.mockResolvedValue(emptyImage())
    createFromPath.mockReturnValue(fakeImage({ width: 800, height: 600 }))

    expect(await resolveThumbnail(file)).not.toBeNull()
  })

  it('scales the decoder fallback down to fit, preserving aspect ratio', async () => {
    const file = join(sourceDir, 'wide.gif')
    await fs.writeFile(file, 'x')
    createThumbnailFromPath.mockRejectedValue(new Error('unsupported'))
    const resize = vi.fn().mockReturnValue(fakeImage({ width: 480, height: 240 }))
    createFromPath.mockReturnValue({
      isEmpty: () => false,
      getSize: () => ({ width: 1920, height: 960 }),
      resize
    })

    await resolveThumbnail(file, 480)

    expect(resize).toHaveBeenCalledWith({ width: 480, height: 240 })
  })

  it('does not upscale the decoder fallback for images smaller than the cap', async () => {
    const file = join(sourceDir, 'small.gif')
    await fs.writeFile(file, 'x')
    createThumbnailFromPath.mockRejectedValue(new Error('unsupported'))
    const resize = vi.fn()
    createFromPath.mockReturnValue({
      isEmpty: () => false,
      getSize: () => ({ width: 100, height: 50 }),
      resize
    })

    await resolveThumbnail(file, 480)

    expect(resize).not.toHaveBeenCalled()
  })

  it('falls back to decoding just the first GIF frame when both the shell and the Chromium decoder fail', async () => {
    // Reproduces a real 7.8MB, ~300-frame GIF that both nativeImage methods
    // rejected outright (they load every frame to support playback).
    const file = join(sourceDir, 'huge.gif')
    await fs.writeFile(file, 'gif-bytes')
    createThumbnailFromPath.mockRejectedValue(
      new Error('Failed to get thumbnail from local thumbnail cache reference')
    )
    createFromPath.mockReturnValue(emptyImage())
    decodeFirstGifFrame.mockReturnValue({
      width: 720,
      height: 720,
      bgra: Buffer.alloc(720 * 720 * 4)
    })
    createFromBitmap.mockReturnValue(fakeImage({ width: 720, height: 720 }))

    const result = await resolveThumbnail(file)

    expect(result).not.toBeNull()
    expect(decodeFirstGifFrame).toHaveBeenCalledWith(Buffer.from('gif-bytes'))
    expect(createFromBitmap).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ width: 720, height: 720 })
    )
    expect(await fs.readFile(result as string, 'utf8')).toBe('png-bytes')
  })

  it('does not attempt the GIF-frame fallback for non-GIF files', async () => {
    const file = join(sourceDir, 'clip.mp4')
    await fs.writeFile(file, 'x')
    createThumbnailFromPath.mockRejectedValue(new Error('unsupported'))
    createFromPath.mockReturnValue(emptyImage())

    expect(await resolveThumbnail(file)).toBeNull()
    expect(decodeFirstGifFrame).not.toHaveBeenCalled()
  })

  it('returns null when the GIF-frame fallback also fails to decode', async () => {
    const file = join(sourceDir, 'corrupt.gif')
    await fs.writeFile(file, 'not really a gif')
    createThumbnailFromPath.mockRejectedValue(new Error('unsupported'))
    createFromPath.mockReturnValue(emptyImage())
    decodeFirstGifFrame.mockReturnValue(null)

    expect(await resolveThumbnail(file)).toBeNull()
    expect(createFromBitmap).not.toHaveBeenCalled()
  })

  it('generates only once for concurrent requests for the same file', async () => {
    const file = join(sourceDir, 'pic.png')
    await fs.writeFile(file, 'x')

    const [a, b, c] = await Promise.all([
      resolveThumbnail(file),
      resolveThumbnail(file),
      resolveThumbnail(file)
    ])

    expect(createThumbnailFromPath).toHaveBeenCalledTimes(1)
    expect(b).toBe(a)
    expect(c).toBe(a)
  })
})

describe('cacheThumbnailFromBuffer', () => {
  it('writes the buffer to the same path resolveThumbnail would look for', async () => {
    const file = join(sourceDir, 'clip.mp4')
    await fs.writeFile(file, 'video-bytes')
    createThumbnailFromPath.mockRejectedValue(new Error('unsupported'))
    createFromPath.mockReturnValue(emptyImage())

    await cacheThumbnailFromBuffer(file, THUMBNAIL_MAX_SIZE, Buffer.from('captured-frame-png'))
    const result = await resolveThumbnail(file)

    expect(result).not.toBeNull()
    expect(await fs.readFile(result as string, 'utf8')).toBe('captured-frame-png')
    // The cache hit means generation was never attempted.
    expect(createThumbnailFromPath).not.toHaveBeenCalled()
  })

  it('normalizes the path the same way resolveThumbnail does', async () => {
    const file = join(sourceDir, 'clip.mp4')
    await fs.writeFile(file, 'video-bytes')

    await cacheThumbnailFromBuffer(
      file.replace(/\\/g, '/'),
      THUMBNAIL_MAX_SIZE,
      Buffer.from('captured-frame-png')
    )

    expect(await fs.readFile((await resolveThumbnail(file)) as string, 'utf8')).toBe(
      'captured-frame-png'
    )
  })

  it('is a no-op when the source file does not exist', async () => {
    await expect(
      cacheThumbnailFromBuffer(join(sourceDir, 'missing.mp4'), THUMBNAIL_MAX_SIZE, Buffer.from('x'))
    ).resolves.toBeUndefined()
  })

  it('downscales a captured frame larger than maxSize before caching it', async () => {
    // The renderer captures at the video's native resolution (e.g. 1920x1080),
    // which would otherwise get cached at full size instead of as a thumbnail.
    const file = join(sourceDir, 'clip.mp4')
    await fs.writeFile(file, 'video-bytes')
    const resize = vi.fn().mockReturnValue({ toPNG: () => Buffer.from('resized-png') })
    createFromBuffer.mockReturnValue({
      isEmpty: () => false,
      getSize: () => ({ width: 1920, height: 1080 }),
      resize
    })

    await cacheThumbnailFromBuffer(file, 480, Buffer.from('native-resolution-png'))

    expect(resize).toHaveBeenCalledWith({ width: 480, height: 270 })
    expect(await fs.readFile((await resolveThumbnail(file)) as string, 'utf8')).toBe('resized-png')
  })

  it('caches the buffer unchanged when it cannot be decoded to check its size', async () => {
    const file = join(sourceDir, 'clip.mp4')
    await fs.writeFile(file, 'video-bytes')
    createFromBuffer.mockReturnValue(emptyImage())

    await cacheThumbnailFromBuffer(file, 480, Buffer.from('undecodable-but-valid-thumbnail'))

    expect(await fs.readFile((await resolveThumbnail(file)) as string, 'utf8')).toBe(
      'undecodable-but-valid-thumbnail'
    )
  })
})
