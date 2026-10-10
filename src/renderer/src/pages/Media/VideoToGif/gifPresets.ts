export type GifPresetId = 'discord' | 'x' | 'gallery' | 'custom'

export interface GifSettings {
  /** Output width in px, or the video's own width; height follows its aspect ratio. */
  width: number | 'source'
  /** Frames per second, or the video's own frame rate (detected, capped at MAX_GIF_FPS). */
  fps: number | 'source'
  /** Upload limit the result must fit under - it's re-encoded smaller until it does. */
  maxBytes?: number
  /**
   * Error-diffusion dithering: smooth gradients instead of color bands, at
   * the cost of a bigger file (noise compresses worse), so only where size
   * doesn't matter.
   */
  dither?: boolean
}

const MB = 1024 * 1024

/**
 * Discord's upload limit without Nitro is 10 MB and X/Twitter's for GIFs is
 * 15 MB; "Gallery" is for keeping it here, so it keeps every pixel and frame
 * of the video - e.g. to rebuild a GIF that a site re-encoded as MP4.
 */
export const GIF_PRESETS: Record<Exclude<GifPresetId, 'custom'>, GifSettings> = {
  discord: { width: 480, fps: 15, maxBytes: 10 * MB },
  x: { width: 540, fps: 15, maxBytes: 15 * MB },
  gallery: { width: 'source', fps: 'source', dither: true }
}

/** Starting values of the custom size, before the user picks their own. */
export const DEFAULT_CUSTOM_SETTINGS: GifSettings = { width: 720, fps: 20 }

/** Longest clip that can be converted: GIFs grow fast and are meant to be short. */
export const MAX_CLIP_SECONDS = 10

/**
 * GIF frame delays are in hundredths of a second and browsers slow anything
 * under 2/100 s down to 10/100 s, so 50 fps is the fastest a GIF really plays.
 */
export const MAX_GIF_FPS = 50

/** Each retry to fit under `maxBytes` shrinks the width by this factor. */
export const SHRINK_FACTOR = 0.85
export const MIN_WIDTH = 160

export function formatMegabytes(bytes: number): string {
  return (bytes / MB).toFixed(1)
}

/**
 * Per-frame delays in ms that add up to the clip's real duration: each is a
 * whole number of hundredths, so e.g. 30 fps alternates 30 and 40 ms instead
 * of rounding every frame to 30 ms and playing too fast.
 */
export function frameDelays(frames: number, fps: number): number[] {
  const hundredthsAt = (frame: number): number => Math.round((frame * 100) / fps)
  return Array.from({ length: frames }, (_, i) => (hundredthsAt(i + 1) - hundredthsAt(i)) * 10)
}
