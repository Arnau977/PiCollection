import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import { ditherToPalette } from './ditherToPalette'

/**
 * Encodes frames off the main thread: quantizing to a 256-color palette is
 * the slow part, and doing it in the page would freeze the dialog's progress
 * bar and Cancel button.
 */
export type GifWorkerRequest =
  | {
      type: 'frame'
      rgba: Uint8ClampedArray
      width: number
      height: number
      delay: number
      dither: boolean
    }
  | { type: 'finish' }

export type GifWorkerResponse = { type: 'frameDone' } | { type: 'done'; bytes: Uint8Array }

const encoder = GIFEncoder()

self.onmessage = (event: MessageEvent<GifWorkerRequest>): void => {
  const message = event.data
  if (message.type === 'frame') {
    const { rgba, width, height } = message
    // rgb444 bins colors more coarsely before clustering, which is ~60x faster on
    // a full-size frame; the palette still holds full-precision averages, and
    // dithering hides the difference (same error as rgb565 in a benchmark).
    const palette = quantize(rgba, 256, { format: message.dither ? 'rgb444' : 'rgb565' })
    const index = message.dither
      ? ditherToPalette(rgba, width, height, palette)
      : applyPalette(rgba, palette)
    encoder.writeFrame(index, width, height, { palette, delay: message.delay })
    self.postMessage({ type: 'frameDone' } satisfies GifWorkerResponse)
    return
  }
  encoder.finish()
  const bytes = encoder.bytes()
  self.postMessage({ type: 'done', bytes } satisfies GifWorkerResponse, {
    transfer: [bytes.buffer]
  })
}
