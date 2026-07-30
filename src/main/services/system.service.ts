import { nativeImage, type NativeImage } from 'electron'
import { promises as fs } from 'fs'
import { extname } from 'path'
import { decodeFirstGifFrame } from '../thumbnails/gifFirstFrame'

/**
 * Loads a file as a full-resolution image for clipboard copying. Chromium's
 * own decoder loads every frame of a GIF to support playback, so it can
 * reject large/many-frame GIFs outright - the same failure mode `thumbnails.ts`
 * works around, worth reusing here since it hit the copy-to-clipboard button too.
 */
export async function loadImageForClipboard(filePath: string): Promise<NativeImage | null> {
  const decoded = nativeImage.createFromPath(filePath)
  if (!decoded.isEmpty()) return decoded

  if (extname(filePath).toLowerCase() !== '.gif') return null

  try {
    const buf = await fs.readFile(filePath)
    const frame = decodeFirstGifFrame(buf)
    if (!frame) return null
    const bitmap = nativeImage.createFromBitmap(frame.bgra, {
      width: frame.width,
      height: frame.height
    })
    return bitmap.isEmpty() ? null : bitmap
  } catch {
    return null
  }
}
