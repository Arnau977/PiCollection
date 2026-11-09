export type GifPresetId = 'discord' | 'x' | 'gallery' | 'custom'

/**
 * GIF opens anywhere but holds 256 colors per frame; an animated WebP keeps
 * every color in a much smaller file. Discord plays it; X takes GIFs only.
 */
export type AnimationFormat = 'gif' | 'webp'

/** How each format is named in labels ("Create WebP"); not translated. */
export const FORMAT_LABEL: Record<AnimationFormat, string> = { gif: 'GIF', webp: 'WebP' }

/** The size presets offered for each format: X only takes GIFs. */
export const PRESETS_FOR_FORMAT: Record<AnimationFormat, GifPresetId[]> = {
  gif: ['discord', 'x', 'gallery', 'custom'],
  webp: ['discord', 'gallery', 'custom']
}

/** canvas.toBlob quality for a WebP frame, unless the preset sets its own. */
export const WEBP_QUALITY = 0.85

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
  /** WebP frame quality (0-1); WEBP_QUALITY when unset. GIFs ignore it. */
  webpQuality?: number
}

export const MB = 1024 * 1024

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

/**
 * A WebP of the same clip weighs about a third of the GIF (3.3 vs 9.9 MB in
 * a test at 480 px, 15 fps), so under the same limit it starts bigger and
 * smoother; a clip that still doesn't fit is shrunk like a GIF.
 */
export const WEBP_PRESETS: Record<Exclude<GifPresetId, 'custom' | 'x'>, GifSettings> = {
  discord: { width: 720, fps: 24, maxBytes: 10 * MB },
  gallery: { width: 'source', fps: 'source', webpQuality: 0.95 }
}

/** What a preset means in a format; X only takes GIFs, so it's always the GIF one. */
export function presetSettings(
  format: AnimationFormat,
  id: Exclude<GifPresetId, 'custom'>
): GifSettings {
  return format === 'webp' && id !== 'x' ? WEBP_PRESETS[id] : GIF_PRESETS[id]
}

/** Starting values of the custom size, before the user picks their own. */
export const DEFAULT_CUSTOM_SETTINGS: GifSettings = { width: 720, fps: 20 }

/**
 * From this length on the dialog notes that the GIF may get very large and
 * slow to make. Not a limit: a loop can need 15 s and a few frames more.
 */
export const LONG_CLIP_SECONDS = 30

/** The clip offered when the player had no section marked. */
export const DEFAULT_CLIP_SECONDS = 5

/**
 * GIF frame delays are in hundredths of a second and browsers slow anything
 * under 2/100 s down to 10/100 s, so 50 fps is the fastest a GIF really plays.
 */
export const MAX_GIF_FPS = 50

/** Each retry to fit under `maxBytes` shrinks the width by at least this factor. */
export const SHRINK_FACTOR = 0.85
export const MIN_WIDTH = 160

/**
 * How a file's size grows with its width: size ~ width^exponent, measured on
 * a real 5 s clip at 24 fps. GIF: 30.5 MB at 720 px, 6.6 at 277, 4.9 at 229
 * (1.6 both steps). WebP: 8.3 MB at 720, 5.9 at 530, 4.8 at 451 (1.1-1.2) -
 * its compression does better on bigger frames, so its size falls almost in
 * step with the width.
 */
export const SIZE_EXPONENT: Record<AnimationFormat, number> = { gif: 1.6, webp: 1.15 }

/**
 * The width to retry at after `bytes` came out over `maxBytes`, from how far
 * over it went and how the format's size follows the width, with a 10%
 * margin - one retry usually fits, where a fixed 15% step took several.
 */
export function retryWidth(
  width: number,
  bytes: number,
  maxBytes: number,
  format: AnimationFormat
): number {
  const scale = Math.min(SHRINK_FACTOR, ((maxBytes * 0.9) / bytes) ** (1 / SIZE_EXPONENT[format]))
  return Math.round(width * scale)
}

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
