/**
 * Builds an animated WebP from still WebP files (what `canvas.toBlob` makes),
 * without decoding them: each still's image chunks (ALPH, VP8 or VP8L) go
 * into an ANMF frame as they are. Every frame covers the whole canvas and
 * replaces the previous one, which is what frames grabbed from a video are.
 * Format: https://developers.google.com/speed/webp/docs/riff_container
 */

export interface WebpFrame {
  /** A complete still WebP file. */
  webp: Uint8Array
  /** How long it shows, in ms. */
  duration: number
}

const IMAGE_CHUNKS = new Set(['ALPH', 'VP8 ', 'VP8L'])

function fourcc(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + 4))
}

/** The still's image chunks, header and padding included, and whether they carry alpha. */
function imageChunks(webp: Uint8Array): { chunks: Uint8Array[]; alpha: boolean } {
  if (fourcc(webp, 0) !== 'RIFF' || fourcc(webp, 8) !== 'WEBP') throw new Error('not-webp')
  const view = new DataView(webp.buffer, webp.byteOffset, webp.byteLength)
  const chunks: Uint8Array[] = []
  let alpha = false
  for (let offset = 12; offset + 8 <= webp.length; ) {
    const id = fourcc(webp, offset)
    const size = view.getUint32(offset + 4, true)
    const end = offset + 8 + size + (size % 2)
    if (IMAGE_CHUNKS.has(id)) {
      chunks.push(webp.subarray(offset, end))
      if (id !== 'VP8 ') alpha = true
    }
    offset = end
  }
  if (chunks.length === 0) throw new Error('not-webp')
  return { chunks, alpha }
}

function chunk(id: string, payload: Uint8Array): Uint8Array {
  const padded = payload.length + (payload.length % 2)
  const out = new Uint8Array(8 + padded)
  for (let i = 0; i < 4; i++) out[i] = id.charCodeAt(i)
  new DataView(out.buffer).setUint32(4, payload.length, true)
  out.set(payload, 8)
  return out
}

function uint24(out: Uint8Array, offset: number, value: number): void {
  out[offset] = value & 0xff
  out[offset + 1] = (value >> 8) & 0xff
  out[offset + 2] = (value >> 16) & 0xff
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** An endlessly looping animated WebP of `width` x `height` from `frames`. */
export function muxAnimatedWebp(frames: WebpFrame[], width: number, height: number): Uint8Array {
  let alpha = false
  const anmf = frames.map(({ webp, duration }) => {
    const image = imageChunks(webp)
    alpha ||= image.alpha
    const header = new Uint8Array(16)
    // Offset 0,0 (6 bytes of zeros), then size and duration.
    uint24(header, 6, width - 1)
    uint24(header, 9, height - 1)
    uint24(header, 12, Math.max(1, Math.round(duration)))
    // Don't blend with the previous frame; no disposal needed since each covers it all.
    header[15] = 0b10
    return chunk('ANMF', concat([header, ...image.chunks]))
  })

  const vp8x = new Uint8Array(10)
  vp8x[0] = 0b10 | (alpha ? 0b10000 : 0)
  uint24(vp8x, 4, width - 1)
  uint24(vp8x, 7, height - 1)
  // Background color 0 (transparent black), loop count 0 = forever.
  const anim = new Uint8Array(6)

  const body = concat([
    new TextEncoder().encode('WEBP'),
    chunk('VP8X', vp8x),
    chunk('ANIM', anim),
    ...anmf
  ])
  const riff = new Uint8Array(8)
  riff.set(new TextEncoder().encode('RIFF'))
  new DataView(riff.buffer).setUint32(4, body.length, true)
  return concat([riff, body])
}
