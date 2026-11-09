import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { muxAnimatedWebp } from './muxAnimatedWebp'

function still(r: number, options: sharp.WebpOptions): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: { r, g: 80, b: 160 } } })
    .webp(options)
    .toBuffer()
}

describe('muxAnimatedWebp', () => {
  it('joins still WebPs into one looping animation libwebp can read', async () => {
    // Lossy and lossless stills, as canvas.toBlob may produce either.
    const frames = [
      { webp: new Uint8Array(await still(200, { quality: 80 })), duration: 40 },
      { webp: new Uint8Array(await still(20, { quality: 80 })), duration: 30 },
      { webp: new Uint8Array(await still(120, { lossless: true })), duration: 40 }
    ]

    const bytes = muxAnimatedWebp(frames, 40, 30)
    const meta = await sharp(Buffer.from(bytes), { animated: true }).metadata()

    expect(meta.format).toBe('webp')
    expect(meta.pages).toBe(3)
    expect(meta.width).toBe(40)
    expect(meta.pageHeight).toBe(30)
    expect(meta.delay).toEqual([40, 30, 40])
    expect(meta.loop).toBe(0)
    // Every frame decodes, with its own color.
    const { data } = await sharp(Buffer.from(bytes), { page: 1 }).raw().toBuffer({
      resolveWithObject: true
    })
    expect(data[0]).toBeLessThan(60)
  })

  it('refuses something that is not a WebP', () => {
    expect(() => muxAnimatedWebp([{ webp: new Uint8Array(20), duration: 40 }], 1, 1)).toThrow()
  })
})
