import { GIFEncoder, applyPalette, quantize } from 'gifenc'

/**
 * Encodes frames off the main thread: quantizing to a 256-color palette is
 * the slow part, and doing it in the page would freeze the dialog's progress
 * bar and Cancel button.
 */
export type GifWorkerRequest =
  | { type: 'frame'; rgba: Uint8ClampedArray; width: number; height: number; delay: number }
  | { type: 'finish' }

export type GifWorkerResponse = { type: 'frameDone' } | { type: 'done'; bytes: Uint8Array }

const encoder = GIFEncoder()

self.onmessage = (event: MessageEvent<GifWorkerRequest>): void => {
  const message = event.data
  if (message.type === 'frame') {
    const palette = quantize(message.rgba, 256)
    const index = applyPalette(message.rgba, palette)
    encoder.writeFrame(index, message.width, message.height, { palette, delay: message.delay })
    self.postMessage({ type: 'frameDone' } satisfies GifWorkerResponse)
    return
  }
  encoder.finish()
  const bytes = encoder.bytes()
  self.postMessage({ type: 'done', bytes } satisfies GifWorkerResponse, {
    transfer: [bytes.buffer]
  })
}
