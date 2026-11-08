import { extname } from 'path'
import type { MediaModel } from '@shared/models'
import { isAnimatedImage } from './clipboardFile'

/**
 * An animated WebP is stored as a GIF, so the badge, hover-to-play and the
 * Type filter treat both formats alike; a still one stays an image. Other
 * files keep the type they came with. An unreadable file keeps it too.
 */
export async function resolveMediaType(
  type: MediaModel['type'],
  absolutePath: string
): Promise<MediaModel['type']> {
  if (type === 'video' || extname(absolutePath).toLowerCase() !== '.webp') return type
  return (await isAnimatedImage(absolutePath).catch(() => false)) ? 'gif' : 'image'
}
