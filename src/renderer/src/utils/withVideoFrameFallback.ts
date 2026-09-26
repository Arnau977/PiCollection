import type { IpcResult } from '@shared/ipc/contracts'
import type { MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { captureVideoFrame } from '../components/MediaThumb/captureVideoFrame'

/**
 * SauceNAO and WD14 read the gallery's cached thumbnail, which for videos
 * comes from the OS thumbnail provider - and that can refuse a video Chromium
 * plays fine (observed: every video on a secondary drive failing with
 * "Failed to get thumbnail from local thumbnail cache reference"). On that
 * specific failure, grab a frame here the way the gallery's MediaThumb
 * already does, cache it, and try once more.
 */
export async function withVideoFrameFallback<T>(
  route: string,
  type: MediaModel['type'] | undefined,
  call: () => Promise<IpcResult<T>>
): Promise<IpcResult<T>> {
  const first = await call()
  if (first.success || type !== 'video' || first.error.code !== 'NO_THUMBNAIL') return first

  const frame = await captureVideoFrame(toMediaUrl(route))
  if (!frame) return first
  const cached = await window.api.media.cacheThumbnail(
    route,
    new Uint8Array(await frame.arrayBuffer())
  )
  return cached.success ? call() : first
}
