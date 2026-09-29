import { describe, expect, it } from 'vitest'
import { deflateSync } from 'zlib'
import { detectAiMetadataInBuffer } from './aiMetadata.service'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  // The CRC isn't checked by the detector.
  return Buffer.concat([length, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)])
}

function png(...chunks: Buffer[]): Buffer {
  return Buffer.concat([PNG_SIGNATURE, ...chunks, chunk('IEND', Buffer.alloc(0))])
}

const tEXt = (keyword: string, text: string): Buffer =>
  chunk('tEXt', Buffer.from(`${keyword}\0${text}`, 'latin1'))

describe('detectAiMetadataInBuffer', () => {
  it('recognizes Stable Diffusion WebUI parameters in a PNG', () => {
    const file = png(tEXt('parameters', 'a cat\nSteps: 20, Sampler: Euler a'))
    expect(detectAiMetadataInBuffer(file)).toEqual({ generator: 'Stable Diffusion WebUI' })
  })

  it('reads a compressed iTXt ComfyUI workflow', () => {
    const data = Buffer.concat([
      Buffer.from('workflow\0', 'latin1'),
      Buffer.from([1, 0]),
      Buffer.from('\0\0', 'latin1'),
      deflateSync(Buffer.from('{"nodes":[]}'))
    ])
    expect(detectAiMetadataInBuffer(png(chunk('iTXt', data)))).toEqual({ generator: 'ComfyUI' })
  })

  it('flags IPTC fully generated media but not AI-edited composites', () => {
    const iptc = 'http://cv.iptc.org/newscodes/digitalsourcetype/'
    const jpeg = (sourceType: string): Buffer =>
      Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from(`<xmp>${iptc}${sourceType}</xmp>`)])

    expect(detectAiMetadataInBuffer(jpeg('trainedAlgorithmicMedia'))).toEqual({
      generator: 'Content Credentials'
    })
    expect(detectAiMetadataInBuffer(jpeg('compositeWithTrainedAlgorithmicMedia'))).toBeNull()
  })

  it('finds WebUI parameters stored as UTF-16 in EXIF', () => {
    const comment = Buffer.from('Steps: 28, Sampler: DPM++ 2M', 'utf16le').swap16()
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('UNICODE\0'), comment])
    expect(detectAiMetadataInBuffer(jpeg)).toEqual({ generator: 'Stable Diffusion WebUI' })
  })

  it('finds nothing in a PNG with only ordinary text', () => {
    expect(detectAiMetadataInBuffer(png(tEXt('Title', 'Holiday')))).toBeNull()
  })
})
