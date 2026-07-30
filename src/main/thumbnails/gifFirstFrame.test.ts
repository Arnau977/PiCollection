import { describe, expect, it } from 'vitest'
import { decodeFirstGifFrame } from './gifFirstFrame'

/**
 * Minimal GIF encoder for test fixtures only. Does not compress: it emits one
 * LZW code per pixel (always a literal color-table index, always valid) while
 * mirroring the exact dictionary-growth bookkeeping the decoder performs, so
 * the code size grows in lockstep between writer and reader. This is a valid,
 * if inefficient, GIF encoding - real decoders (and this project's) accept it.
 */
class BitWriter {
  private bytes: number[] = []
  private bitBuffer = 0
  private bitCount = 0

  writeCode(code: number, codeSize: number): void {
    this.bitBuffer |= code << this.bitCount
    this.bitCount += codeSize
    while (this.bitCount >= 8) {
      this.bytes.push(this.bitBuffer & 0xff)
      this.bitBuffer >>= 8
      this.bitCount -= 8
    }
  }

  finish(): Buffer {
    if (this.bitCount > 0) this.bytes.push(this.bitBuffer & 0xff)
    return Buffer.from(this.bytes)
  }
}

function lzwEncode(pixels: number[], minCodeSize: number): Buffer {
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  const MAX_CODE_SIZE = 12
  const writer = new BitWriter()

  let codeSize = minCodeSize + 1
  let nextCode = endCode + 1
  writer.writeCode(clearCode, codeSize)

  let prevExists = false
  for (const px of pixels) {
    writer.writeCode(px, codeSize)
    if (prevExists && nextCode < 1 << MAX_CODE_SIZE) {
      nextCode++
      if (nextCode === 1 << codeSize && codeSize < MAX_CODE_SIZE) codeSize++
    }
    prevExists = true
  }
  writer.writeCode(endCode, codeSize)

  return writer.finish()
}

function toSubBlocks(data: Buffer): Buffer {
  const chunks: Buffer[] = []
  for (let o = 0; o < data.length; o += 255) {
    const chunk = data.subarray(o, Math.min(o + 255, data.length))
    chunks.push(Buffer.from([chunk.length]), chunk)
  }
  chunks.push(Buffer.from([0]))
  return Buffer.concat(chunks)
}

interface FrameSpec {
  width: number
  height: number
  left?: number
  top?: number
  /** Color-table index per pixel, row-major. */
  pixels: number[]
  interlaced?: boolean
}

function buildGif(
  screenWidth: number,
  screenHeight: number,
  globalColors: [number, number, number][],
  frames: FrameSpec[]
): Buffer {
  const parts: Buffer[] = []
  parts.push(Buffer.from('GIF89a', 'ascii'))

  const gctSizeExp = Math.max(0, Math.ceil(Math.log2(globalColors.length)) - 1)
  const gctEntries = 2 << gctSizeExp
  const packed = 0x80 | (gctSizeExp & 0x07)
  const lsd = Buffer.alloc(7)
  lsd.writeUInt16LE(screenWidth, 0)
  lsd.writeUInt16LE(screenHeight, 2)
  lsd[4] = packed
  parts.push(lsd)

  const gct = Buffer.alloc(gctEntries * 3)
  globalColors.forEach(([r, g, b], i) => {
    gct[i * 3] = r
    gct[i * 3 + 1] = g
    gct[i * 3 + 2] = b
  })
  parts.push(gct)

  const minCodeSize = Math.max(2, gctSizeExp + 1)

  for (const frame of frames) {
    // Graphic Control Extension (harmless filler the decoder must skip).
    parts.push(Buffer.from([0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00]))

    const imgPacked = frame.interlaced ? 0x40 : 0x00
    const descriptor = Buffer.alloc(10)
    descriptor[0] = 0x2c
    descriptor.writeUInt16LE(frame.left ?? 0, 1)
    descriptor.writeUInt16LE(frame.top ?? 0, 3)
    descriptor.writeUInt16LE(frame.width, 5)
    descriptor.writeUInt16LE(frame.height, 7)
    descriptor[9] = imgPacked
    parts.push(descriptor)

    const pixels = frame.interlaced
      ? interlacePixels(frame.pixels, frame.width, frame.height)
      : frame.pixels
    parts.push(Buffer.from([minCodeSize]))
    parts.push(toSubBlocks(lzwEncode(pixels, minCodeSize)))
  }

  parts.push(Buffer.from([0x3b]))
  return Buffer.concat(parts)
}

function interlacePixels(pixels: number[], width: number, height: number): number[] {
  const rows: number[][] = []
  for (let y = 0; y < height; y++) rows.push(pixels.slice(y * width, y * width + width))
  const order: number[] = []
  const passes = [
    { start: 0, step: 8 },
    { start: 4, step: 8 },
    { start: 2, step: 4 },
    { start: 1, step: 2 }
  ]
  for (const pass of passes) {
    for (let y = pass.start; y < height; y += pass.step) order.push(y)
  }
  return order.flatMap((y) => rows[y])
}

const RED: [number, number, number] = [255, 0, 0]
const GREEN: [number, number, number] = [0, 255, 0]
const BLUE: [number, number, number] = [0, 0, 255]
const WHITE: [number, number, number] = [255, 255, 255]

describe('decodeFirstGifFrame', () => {
  it('decodes a simple single-frame GIF to BGRA', () => {
    // 2x2: red, green / blue, white.
    const gif = buildGif(
      2,
      2,
      [RED, GREEN, BLUE, WHITE],
      [{ width: 2, height: 2, pixels: [0, 1, 2, 3] }]
    )

    const frame = decodeFirstGifFrame(gif)

    expect(frame).not.toBeNull()
    expect(frame?.width).toBe(2)
    expect(frame?.height).toBe(2)
    // Pixel (0,0) = red -> BGRA
    expect(Array.from(frame!.bgra.subarray(0, 4))).toEqual([0, 0, 255, 255])
    // Pixel (1,0) = green
    expect(Array.from(frame!.bgra.subarray(4, 8))).toEqual([0, 255, 0, 255])
    // Pixel (0,1) = blue
    expect(Array.from(frame!.bgra.subarray(8, 12))).toEqual([255, 0, 0, 255])
    // Pixel (1,1) = white
    expect(Array.from(frame!.bgra.subarray(12, 16))).toEqual([255, 255, 255, 255])
  })

  it('only decodes the first frame of a multi-frame animation', () => {
    const gif = buildGif(
      1,
      1,
      [RED, GREEN],
      [
        { width: 1, height: 1, pixels: [0] },
        { width: 1, height: 1, pixels: [1] },
        { width: 1, height: 1, pixels: [1] }
      ]
    )

    const frame = decodeFirstGifFrame(gif)

    expect(Array.from(frame!.bgra)).toEqual([0, 0, 255, 255])
  })

  it('handles a larger frame that forces LZW code size to grow', () => {
    const width = 20
    const height = 20
    const colors: [number, number, number][] = Array.from({ length: 16 }, (_, i) => [
      i * 16,
      i * 8,
      i * 4
    ])
    const pixels = Array.from({ length: width * height }, (_, i) => i % colors.length)
    const gif = buildGif(width, height, colors, [{ width, height, pixels }])

    const frame = decodeFirstGifFrame(gif)

    expect(frame).not.toBeNull()
    expect(frame?.width).toBe(width)
    expect(frame?.height).toBe(height)
    // Spot-check a pixel deep enough in the stream to exercise dictionary growth.
    const i = 250
    const expected = colors[pixels[i]]
    const off = i * 4
    expect(Array.from(frame!.bgra.subarray(off, off + 4))).toEqual([
      expected[2],
      expected[1],
      expected[0],
      255
    ])
  })

  it('de-interlaces a frame correctly', () => {
    // 1x4 column: row0=red, row1=green, row2=blue, row3=white.
    const gif = buildGif(
      1,
      4,
      [RED, GREEN, BLUE, WHITE],
      [{ width: 1, height: 4, pixels: [0, 1, 2, 3], interlaced: true }]
    )

    const frame = decodeFirstGifFrame(gif)

    expect(Array.from(frame!.bgra.subarray(0, 4))).toEqual([0, 0, 255, 255])
    expect(Array.from(frame!.bgra.subarray(4, 8))).toEqual([0, 255, 0, 255])
    expect(Array.from(frame!.bgra.subarray(8, 12))).toEqual([255, 0, 0, 255])
    expect(Array.from(frame!.bgra.subarray(12, 16))).toEqual([255, 255, 255, 255])
  })

  it('composites a frame smaller than the logical screen at its offset', () => {
    // 4x1 screen, a 2-pixel-wide frame placed at x=2.
    const gif = buildGif(
      4,
      1,
      [RED, GREEN],
      [{ width: 2, height: 1, left: 2, top: 0, pixels: [1, 1] }]
    )

    const frame = decodeFirstGifFrame(gif)

    expect(frame?.width).toBe(4)
    // Pixels 0-1 (outside the frame) default to transparent black.
    expect(Array.from(frame!.bgra.subarray(0, 4))).toEqual([0, 0, 0, 0])
    // Pixels 2-3 (inside the frame) are green.
    expect(Array.from(frame!.bgra.subarray(8, 12))).toEqual([0, 255, 0, 255])
    expect(Array.from(frame!.bgra.subarray(12, 16))).toEqual([0, 255, 0, 255])
  })

  it('returns null for a non-GIF buffer', () => {
    expect(decodeFirstGifFrame(Buffer.from('not a gif at all'))).toBeNull()
  })

  it('returns null for a truncated/empty buffer', () => {
    expect(decodeFirstGifFrame(Buffer.alloc(0))).toBeNull()
    expect(decodeFirstGifFrame(Buffer.from('GIF89a'))).toBeNull()
  })

  it('returns null when there is no image descriptor before the trailer', () => {
    const noFrames = Buffer.concat([
      Buffer.from('GIF89a', 'ascii'),
      Buffer.from([2, 0, 2, 0, 0x80, 0, 0]),
      Buffer.from([255, 0, 0, 0, 255, 0]),
      Buffer.from([0x3b])
    ])

    expect(decodeFirstGifFrame(noFrames)).toBeNull()
  })
})
