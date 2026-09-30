import { describe, expect, it } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { isAnimatedImage } from './clipboardFile'

// RIFF header + a VP8X chunk whose flags byte (offset 20) carries the animation bit.
function webp(flags: number): Buffer {
  const header = Buffer.alloc(30)
  header.write('RIFF', 0, 'ascii')
  header.write('WEBPVP8X', 8, 'ascii')
  header[20] = flags
  return header
}

describe('isAnimatedImage', () => {
  it('treats GIFs and animated WebPs as animated, not a still WebP', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'clipboard-file-'))
    const animated = join(dir, 'anim.webp')
    const still = join(dir, 'still.webp')
    await fs.writeFile(animated, webp(0x02 | 0x10))
    await fs.writeFile(still, webp(0x10))

    expect(await isAnimatedImage(animated)).toBe(true)
    expect(await isAnimatedImage(still)).toBe(false)
    expect(await isAnimatedImage(join(dir, 'never-read.gif'))).toBe(true)
    await fs.rm(dir, { recursive: true, force: true })
  })
})
