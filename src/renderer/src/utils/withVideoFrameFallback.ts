import type { RefObject } from 'react'
import type { IpcResult } from '@shared/ipc/contracts'
import type { MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import { captureVideoFrame } from '../components/MediaThumb/captureVideoFrame'
import type { VideoFrameSource } from '../components/VideoPlayer/videoFrame'

/** Longest side of a frame sent for suggestions: the stored thumbnails' size. */
const FRAME_LOOKUP_SIZE = 480

/**
 * For a video, the frame its edit-form preview is showing, as PNG bytes -
 * what SauceNAO/WD14 look at instead of the cover once the user has played
 * or moved the preview. Null for other types, or a preview still at 0:00.
 */
export async function shownFrameBytes(
  type: MediaModel['type'] | undefined,
  frame: RefObject<VideoFrameSource | null> | undefined
): Promise<Uint8Array | null> {
  if (type !== 'video') return null
  const blob = await frame?.current?.captureShownFrame(FRAME_LOOKUP_SIZE)
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}

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
