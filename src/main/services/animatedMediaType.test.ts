import { describe, expect, it } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { resolveMediaType } from './animatedMediaType'

// RIFF header + a VP8X chunk whose flags byte (offset 20) carries the animation bit.
function webp(flags: number): Buffer {
  const header = Buffer.alloc(30)
  header.write('RIFF', 0, 'ascii')
  header.write('WEBPVP8X', 8, 'ascii')
  header[20] = flags
  return header
}

describe('resolveMediaType', () => {
  it('stores an animated WebP as a GIF and leaves the rest alone', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'media-type-'))
    const animated = join(dir, 'anim.WEBP')
    const still = join(dir, 'still.webp')
    await fs.writeFile(animated, webp(0x02 | 0x10))
    await fs.writeFile(still, webp(0x10))

    expect(await resolveMediaType('image', animated)).toBe('gif')
    // A file replaced by a still one goes back to being a picture.
    expect(await resolveMediaType('gif', still)).toBe('image')
    expect(await resolveMediaType('image', join(dir, 'missing.webp'))).toBe('image')
    expect(await resolveMediaType('gif', join(dir, 'a.gif'))).toBe('gif')
    await fs.rm(dir, { recursive: true, force: true })
  })
})
