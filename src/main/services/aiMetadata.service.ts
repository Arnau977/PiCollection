import { open } from 'fs/promises'
import { inflateSync } from 'zlib'
import type { AiMetadataDetection } from '@shared/models'

/** Past this, reading the whole file to look for a marker isn't worth it. */
const MAX_BYTES = 64 * 1024 * 1024

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * IPTC's "digital source type" for media made entirely by a generative
 * model - written into XMP by several generators and into C2PA manifests
 * (OpenAI, Adobe Firefly, Google...). The leading slash keeps out
 * `compositeWithTrainedAlgorithmicMedia`, which only means AI-edited.
 */
const IPTC_FULLY_GENERATED = Buffer.from('/trainedAlgorithmicMedia')

/** Stable Diffusion WebUI (A1111/Forge) writes its parameters into EXIF UserComment on JPEG/WebP - often as UTF-16. */
const A1111_MARKERS = ['Steps: ', 'Sampler: ']

function textChunks(buffer: Buffer): Map<string, string> {
  const chunks = new Map<string, string>()
  let offset = PNG_SIGNATURE.length
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('latin1', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IEND') break
    try {
      const nul = data.indexOf(0)
      if (nul > 0) {
        const keyword = data.toString('latin1', 0, nul)
        if (type === 'tEXt') chunks.set(keyword, data.toString('latin1', nul + 1))
        if (type === 'zTXt')
          chunks.set(keyword, inflateSync(data.subarray(nul + 2)).toString('latin1'))
        if (type === 'iTXt') {
          const compressed = data[nul + 1] === 1
          const langEnd = data.indexOf(0, nul + 3)
          const translatedEnd = data.indexOf(0, langEnd + 1)
          const text = data.subarray(translatedEnd + 1)
          chunks.set(keyword, (compressed ? inflateSync(text) : text).toString('utf8'))
        }
      }
    } catch {
      // A malformed chunk just isn't evidence of anything.
    }
    offset += 12 + length
  }
  return chunks
}

function fromPngText(chunks: Map<string, string>): string | null {
  if (chunks.has('parameters')) return 'Stable Diffusion WebUI'
  if (chunks.has('workflow') || chunks.has('prompt')) return 'ComfyUI'
  if (chunks.has('invokeai_metadata') || chunks.has('sd-metadata')) return 'InvokeAI'
  if (
    /novelai/i.test(chunks.get('Software') ?? '') ||
    /novelai/i.test(chunks.get('Source') ?? '')
  ) {
    return 'NovelAI'
  }
  return null
}

function containsText(buffer: Buffer, text: string): boolean {
  const le = Buffer.from(text, 'utf16le')
  const be = Buffer.from(le).swap16()
  return [Buffer.from(text), le, be].some((needle) => buffer.includes(needle))
}

/**
 * Looks for the traces generators leave inside the file itself. Only a
 * hint: most sites strip metadata on upload, so finding nothing proves
 * nothing, and a positive only says the image came out of a generator.
 */
export function detectAiMetadataInBuffer(buffer: Buffer): AiMetadataDetection | null {
  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    const generator = fromPngText(textChunks(buffer))
    if (generator) return { generator }
  }
  if (buffer.includes(IPTC_FULLY_GENERATED)) return { generator: 'Content Credentials' }
  if (A1111_MARKERS.every((marker) => containsText(buffer, marker))) {
    return { generator: 'Stable Diffusion WebUI' }
  }
  return null
}

export async function detectAiMetadata(path: string): Promise<AiMetadataDetection | null> {
  const file = await open(path, 'r')
  try {
    const { size } = await file.stat()
    if (size > MAX_BYTES) return null
    const buffer = Buffer.alloc(size)
    await file.read(buffer, 0, size, 0)
    return detectAiMetadataInBuffer(buffer)
  } finally {
    await file.close()
  }
}
