import { useCallback, useEffect, useState, type RefObject } from 'react'
import { loadVideoPlayerPrefs, saveVideoPlayerPrefs } from './videoPlayerPrefs'

/** Unmuting never lands quieter than this. */
const MIN_UNMUTED_VOLUME = 0.1

export interface VideoPlayerState {
  playing: boolean
  currentTime: number
  /** null until the element reports a finite duration (NaN/Infinity while loading). */
  duration: number | null
  loop: boolean
  volume: number
  muted: boolean
  rate: number
  fullscreen: boolean
  togglePlay: () => void
  seek: (time: number) => void
  skip: (delta: number) => void
  setLoop: (loop: boolean) => void
  /**
   * Mute is volume 0: setting 0 mutes (keeping the last audible level for
   * unmute), anything above unmutes.
   */
  setVolume: (volume: number) => void
  toggleMute: () => void
  setRate: (rate: number) => void
  toggleFullscreen: (container: HTMLElement) => void
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * Mirrors a native <video>'s state for the app's own controls. Loop, volume
 * and mute carry over between videos (saved); speed starts at 1x each time.
 * A host that must stay silent (the edit-form preview) passes `muted`, which
 * applies to it only and isn't saved.
 */
export function useVideoPlayer(
  videoRef: RefObject<HTMLVideoElement>,
  opts: { muted?: boolean } = {}
): VideoPlayerState {
  const [prefs] = useState(loadVideoPlayerPrefs)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState<number | null>(null)
  const [loop, setLoopState] = useState(prefs.loop)
  const [volume, setVolumeState] = useState(prefs.volume)
  const [muted, setMutedState] = useState(opts.muted ?? prefs.muted)
  const [rate, setRateState] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const forcedMute = opts.muted === true

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.loop = prefs.loop
    video.volume = prefs.volume
    video.muted = opts.muted ?? prefs.muted
    video.playbackRate = 1

    const sync = (): void => {
      setPlaying(!video.paused && !video.ended)
      setCurrentTime(video.currentTime)
      setDuration(finiteOrNull(video.duration))
    }
    const onVolume = (): void => {
      setVolumeState(video.volume)
      setMutedState(video.muted)
    }
    const onRate = (): void => setRateState(video.playbackRate)
    const onFullscreen = (): void => setFullscreen(document.fullscreenElement !== null)

    const mediaEvents = [
      'play',
      'pause',
      'ended',
      'timeupdate',
      'seeked',
      'loadedmetadata',
      'durationchange'
    ]
    for (const event of mediaEvents) video.addEventListener(event, sync)
    video.addEventListener('volumechange', onVolume)
    video.addEventListener('ratechange', onRate)
    document.addEventListener('fullscreenchange', onFullscreen)
    sync()
    return (): void => {
      for (const event of mediaEvents) video.removeEventListener(event, sync)
      video.removeEventListener('volumechange', onVolume)
      video.removeEventListener('ratechange', onRate)
      document.removeEventListener('fullscreenchange', onFullscreen)
    }
    // Only on mount: later changes go through the actions below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef])

  const persist = useCallback(
    (patch: Partial<{ loop: boolean; volume: number; muted: boolean }>) => {
      const current = loadVideoPlayerPrefs()
      saveVideoPlayerPrefs({ ...current, ...patch })
    },
    []
  )

  const seek = useCallback(
    (time: number) => {
      const video = videoRef.current
      if (!video) return
      const max = finiteOrNull(video.duration) ?? Number.POSITIVE_INFINITY
      const clamped = Math.min(Math.max(time, 0), max)
      video.currentTime = clamped
      setCurrentTime(clamped)
    },
    [videoRef]
  )

  return {
    playing,
    currentTime,
    duration,
    loop,
    volume,
    muted,
    rate,
    fullscreen,
    togglePlay: (): void => {
      const video = videoRef.current
      if (!video) return
      // play() can reject (autoplay policy, source gone) - and isn't a promise
      // at all in some environments (jsdom); neither should throw here.
      if (video.paused || video.ended) void Promise.resolve(video.play()).catch(() => undefined)
      else video.pause()
    },
    seek,
    skip: (delta): void => seek((videoRef.current?.currentTime ?? 0) + delta),
    setLoop: (next): void => {
      if (videoRef.current) videoRef.current.loop = next
      setLoopState(next)
      persist({ loop: next })
    },
    setVolume: (next): void => {
      const video = videoRef.current
      if (!video) return
      if (next > 0) video.volume = next
      if (!forcedMute) video.muted = next === 0
      setVolumeState(video.volume)
      setMutedState(video.muted)
      persist({ volume: video.volume, ...(forcedMute ? {} : { muted: video.muted }) })
    },
    toggleMute: (): void => {
      const video = videoRef.current
      if (!video) return
      video.muted = !video.muted
      // Sliding down to 0 keeps the last step (1-2%) as the level: unmuting
      // back to it would sound like nothing happened.
      if (!video.muted && video.volume < MIN_UNMUTED_VOLUME) video.volume = MIN_UNMUTED_VOLUME
      setVolumeState(video.volume)
      setMutedState(video.muted)
      if (!forcedMute) persist({ volume: video.volume, muted: video.muted })
    },
    setRate: (next): void => {
      if (videoRef.current) videoRef.current.playbackRate = next
      setRateState(next)
    },
    toggleFullscreen: (container): void => {
      const request = document.fullscreenElement
        ? document.exitFullscreen?.()
        : container.requestFullscreen?.()
      void Promise.resolve(request).catch(() => undefined)
    }
  }
}
