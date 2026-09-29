export type GifPresetId = 'discord' | 'x' | 'gallery' | 'custom'

export interface GifSettings {
  /** Output width in px; height follows the video's aspect ratio. */
  width: number
  fps: number
  /** Upload limit the result must fit under - it's re-encoded smaller until it does. */
  maxBytes?: number
}

const MB = 1024 * 1024

/**
 * Discord's upload limit without Nitro is 10 MB and X/Twitter's for GIFs is
 * 15 MB; "Gallery" is for keeping it here, so it favors quality over size.
 */
export const GIF_PRESETS: Record<Exclude<GifPresetId, 'custom'>, GifSettings> = {
  discord: { width: 480, fps: 15, maxBytes: 10 * MB },
  x: { width: 540, fps: 15, maxBytes: 15 * MB },
  gallery: { width: 720, fps: 20 }
}

/** Longest clip that can be converted: GIFs grow fast and are meant to be short. */
export const MAX_CLIP_SECONDS = 10

/** Each retry to fit under `maxBytes` shrinks the width by this factor. */
export const SHRINK_FACTOR = 0.85
export const MIN_WIDTH = 160

export function formatMegabytes(bytes: number): string {
  return (bytes / MB).toFixed(1)
}
