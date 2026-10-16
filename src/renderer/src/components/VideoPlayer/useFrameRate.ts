import { useEffect, useState, type RefObject } from 'react'

/** When the decoder's frames can't be observed (or before any were). */
export const FALLBACK_FPS = 30

const SAMPLE_FRAMES = 10

type FrameCallback = (now: number, metadata: { mediaTime: number }) => void
type VideoWithFrames = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: FrameCallback) => number
}

/**
 * The video's frame rate, measured from the frames it presents while it
 * plays (median gap between their media times, so one dropped frame doesn't
 * skew it). Never plays the video itself; 30 fps until measured. Used for
 * frame-by-frame stepping.
 */
export function useFrameRate(videoRef: RefObject<HTMLVideoElement>, src?: string): number {
  const [fps, setFps] = useState(FALLBACK_FPS)

  useEffect(() => {
    // A new video (the same player reused across videos) is measured afresh.
    setFps(FALLBACK_FPS)
    const video = videoRef.current as VideoWithFrames | null
    if (!video?.requestVideoFrameCallback) return
    const times: number[] = []
    let stopped = false

    const onFrame: FrameCallback = (_now, { mediaTime }) => {
      if (stopped) return
      if (times.length === 0 || mediaTime > times[times.length - 1]) times.push(mediaTime)
      if (times.length > SAMPLE_FRAMES) {
        const gaps = times
          .slice(1)
          .map((t, i) => t - times[i])
          .sort((a, b) => a - b)
        const median = gaps[Math.floor(gaps.length / 2)]
        if (median > 0) setFps(Math.round((1 / median) * 100) / 100)
        return
      }
      video.requestVideoFrameCallback?.(onFrame)
    }
    video.requestVideoFrameCallback(onFrame)
    return (): void => {
      stopped = true
    }
  }, [videoRef, src])

  return fps
}
