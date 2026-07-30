import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const createFromPath = vi.fn()
const createFromBitmap = vi.fn()
const decodeFirstGifFrame = vi.fn()

vi.mock('electron', () => ({
  nativeImage: {
    createFromPath: (...args: unknown[]) => createFromPath(...args),
    createFromBitmap: (...args: unknown[]) => createFromBitmap(...args)
  }
}))

vi.mock('../thumbnails/gifFirstFrame', () => ({
  decodeFirstGifFrame: (...args: unknown[]) => decodeFirstGifFrame(...args)
}))

const { loadImageForClipboard } = await import('./system.service')

function fakeImage(): unknown {
  return { isEmpty: () => false }
}

function emptyImage(): unknown {
  return { isEmpty: () => true }
}

let sourceDir = ''

beforeEach(async () => {
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'clipboard-src-'))
  createFromPath.mockReset()
  createFromPath.mockReturnValue(emptyImage())
  createFromBitmap.mockReset()
  createFromBitmap.mockReturnValue(emptyImage())
  decodeFirstGifFrame.mockReset()
  decodeFirstGifFrame.mockReturnValue(null)
})

afterEach(async () => {
  await fs.rm(sourceDir, { recursive: true, force: true })
})

describe('loadImageForClipboard', () => {
  it('returns the Chromium-decoded image when it succeeds', async () => {
    const file = join(sourceDir, 'pic.png')
    await fs.writeFile(file, 'x')
    createFromPath.mockReturnValue(fakeImage())

    const result = await loadImageForClipboard(file)

    expect(result).not.toBeNull()
    expect(decodeFirstGifFrame).not.toHaveBeenCalled()
  })

  it('falls back to decoding just the first GIF frame when the Chromium decoder rejects the file', async () => {
    // Reproduces a real large/many-frame GIF that nativeImage.createFromPath
    // rejects outright (it loads every frame to support playback) even though
    // the thumbnail cache can produce a still frame for the exact same file.
    const file = join(sourceDir, 'huge.gif')
    await fs.writeFile(file, 'gif-bytes')
    createFromPath.mockReturnValue(emptyImage())
    decodeFirstGifFrame.mockReturnValue({
      width: 720,
      height: 720,
      bgra: Buffer.alloc(720 * 720 * 4)
    })
    createFromBitmap.mockReturnValue(fakeImage())

    const result = await loadImageForClipboard(file)

    expect(result).not.toBeNull()
    expect(decodeFirstGifFrame).toHaveBeenCalledWith(Buffer.from('gif-bytes'))
    expect(createFromBitmap).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ width: 720, height: 720 })
    )
  })

  it('does not attempt the GIF-frame fallback for non-GIF files', async () => {
    const file = join(sourceDir, 'clip.mp4')
    await fs.writeFile(file, 'x')
    createFromPath.mockReturnValue(emptyImage())

    const result = await loadImageForClipboard(file)

    expect(result).toBeNull()
    expect(decodeFirstGifFrame).not.toHaveBeenCalled()
  })

  it('returns null when the GIF-frame fallback also fails to decode', async () => {
    const file = join(sourceDir, 'corrupt.gif')
    await fs.writeFile(file, 'not really a gif')
    createFromPath.mockReturnValue(emptyImage())
    decodeFirstGifFrame.mockReturnValue(null)

    expect(await loadImageForClipboard(file)).toBeNull()
    expect(createFromBitmap).not.toHaveBeenCalled()
  })
})
