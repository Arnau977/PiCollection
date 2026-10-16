import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVideoPlayer } from './useVideoPlayer'
import { isFrontPlayer, usePlayerShortcuts } from './usePlayerShortcuts'
import { getInputModality } from './inputModality'
import { useFrameRate } from './useFrameRate'
import { normalizeSection, useSection, type UseSection } from './useSection'
import { VideoControls } from './VideoControls'
import { SKIP_SECONDS, VOLUME_STEP } from './playerConstants'
import './VideoPlayer.css'

/** A start/end range in seconds: the looped section, or Make GIF's clip. */
export interface Section {
  start: number
  end: number
}

interface VideoPlayerProps {
  src: string
  autoPlay?: boolean
  /** Forces the player muted for this host (not saved as a preference). */
  muted?: boolean
  /** Narrow host (the edit-form preview): fewer controls in the pill. */
  compact?: boolean
  className?: string
  onSectionChange?: (section: Section | null) => void
  /** Make GIF: the A-B range is the host's clip, always shown and edited through onChange. */
  rangeMode?: { value: Section; onChange: (section: Section) => void }
  /** The video's duration once known (null while loading). */
  onDurationChange?: (duration: number | null) => void
}

const HIDE_AFTER_MS = 2000
/** How long the "Volume 65%" overlay stays after a keyboard change. */
const FLASH_MS = 1000

/**
 * App-styled video player over a native <video> (no `controls`): a floating
 * pill that fades out 2 s after the last pointer move while playing, but
 * never while paused, hovered or holding keyboard focus.
 */
export function VideoPlayer({
  src,
  autoPlay,
  muted,
  compact = false,
  className,
  onSectionChange,
  rangeMode,
  onDurationChange
}: VideoPlayerProps): JSX.Element {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement | null>(null)
  // Also kept in state: popovers need the element itself, from the first render.
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const player = useVideoPlayer(videoRef, { muted })
  const [recentlyMoved, setRecentlyMoved] = useState(true)
  const [overControls, setOverControls] = useState(false)
  const [focusInside, setFocusInside] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()

  const toggleFullscreen = useCallback(() => {
    if (rootRef.current) player.toggleFullscreen(rootRef.current)
  }, [player])

  const fps = useFrameRate(videoRef, src)
  const ownSection = useSection(player.duration)
  // Range mode (Make GIF): the host owns the range - the clip - so the same
  // looping, markers and [ ] keys edit it through onChange instead. Edits
  // that would leave it too short are dropped, as for the own section.
  const sectionState: UseSection = rangeMode
    ? {
        section: rangeMode.value,
        pendingStart: null,
        setA: (time): void => {
          const next = normalizeSection(time, rangeMode.value.end, player.duration)
          if (next) rangeMode.onChange(next)
        },
        setB: (time): void => {
          const next = normalizeSection(rangeMode.value.start, time, player.duration)
          if (next) rangeMode.onChange(next)
        },
        setSection: (range): void => {
          const next = normalizeSection(range.start, range.end, player.duration)
          if (next) rangeMode.onChange(next)
        },
        clear: (): void => undefined
      }
    : ownSection
  const { section } = sectionState
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>()

  /** Seconds as the element has them now (state can lag a frame behind). */
  const now = (): number => videoRef.current?.currentTime ?? player.currentTime

  function changeVolume(delta: number): void {
    const next = Math.round(Math.min(Math.max(player.volume + delta, 0), 1) * 100) / 100
    // The level changes but sound stays off while muted: M unmutes.
    player.setVolume(next, { keepMuted: true })
    setFlash(t('videoPlayer.volumeLevel', { percent: Math.round(next * 100) }))
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS)
  }

  /** One frame back or forward - only while paused, where it can be seen. */
  function stepFrame(direction: 1 | -1): void {
    if (player.playing) return
    player.seek(now() + direction / fps)
  }

  usePlayerShortcuts(rootRef, {
    togglePlay: player.togglePlay,
    back: () => player.skip(-SKIP_SECONDS),
    forward: () => player.skip(SKIP_SECONDS),
    volumeUp: () => changeVolume(VOLUME_STEP),
    volumeDown: () => changeVolume(-VOLUME_STEP),
    frameBack: () => stepFrame(-1),
    frameForward: () => stepFrame(1),
    loop: () => player.setLoop(!player.loop),
    mute: player.toggleMute,
    fullscreen: toggleFullscreen,
    setA: () => sectionState.setA(now()),
    setB: () => sectionState.setB(now()),
    clearSection: sectionState.clear
  })

  // The section is per video: a new src (the detail page reuses this player
  // from one video to the next) starts without one.
  const { clear: clearSection } = ownSection
  useEffect(() => clearSection(), [src, clearSection])

  // The section loops on its own, whatever the Loop toggle says: reaching B
  // while playing goes back to A, playing from outside it starts at A, and a
  // section ending at the video's end restarts from A instead of stopping.
  // While paused, seeking and frame-stepping outside it are left alone.
  const { seek } = player
  useEffect(() => {
    const video = videoRef.current
    if (!video || !section) return
    const outside = (): boolean =>
      video.currentTime >= section.end || video.currentTime < section.start
    const onTimeUpdate = (): void => {
      if (!video.paused && !video.seeking && outside()) seek(section.start)
    }
    const onPlay = (): void => {
      if (outside()) seek(section.start)
    }
    const onEnded = (): void => {
      seek(section.start)
      void Promise.resolve(video.play()).catch(() => undefined)
    }
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('play', onPlay)
    video.addEventListener('ended', onEnded)
    return (): void => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('ended', onEnded)
    }
  }, [section, seek])

  const ownRange = ownSection.section
  useEffect(() => {
    if (!rangeMode) onSectionChange?.(ownRange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownRange, onSectionChange])

  useEffect(() => {
    onDurationChange?.(player.duration)
  }, [player.duration, onDurationChange])

  function nudge(): void {
    setRecentlyMoved(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setRecentlyMoved(false), HIDE_AFTER_MS)
  }

  useEffect(
    () => (): void => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      if (flashTimer.current) clearTimeout(flashTimer.current)
    },
    []
  )

  // A dialog opening on top (Make GIF, a confirmation, the compare view)
  // pauses this player: it's no longer the one in front, and its sound would
  // play under the dialog. Only watched while playing.
  useEffect(() => {
    const root = rootRef.current
    const video = videoRef.current
    if (!player.playing || !root || !video) return
    const observer = new MutationObserver(() => {
      if (!isFrontPlayer(root) && !video.paused) video.pause()
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal']
    })
    return (): void => observer.disconnect()
  }, [player.playing])

  // Playback starting (autoplay, a shortcut) counts as activity: the pill
  // shows, then hides 2 s later even if the pointer never moves.
  useEffect(() => {
    if (player.playing) nudge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.playing])

  const visible = !player.playing || recentlyMoved || overControls || focusInside

  return (
    <div
      ref={(el) => {
        rootRef.current = el
        setRoot(el)
      }}
      className={`video-player${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      data-controls-visible={visible}
      onPointerMove={nudge}
      // Only keyboard focus keeps the pill up; a mouse click leaves its button
      // focused, and that must not pin the pill over a playing video.
      onFocus={() => setFocusInside(getInputModality() === 'keyboard')}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false)
      }}
    >
      <video
        ref={videoRef}
        className="video-player-media"
        src={src}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        onClick={player.togglePlay}
      >
        Your browser does not support the video tag.
      </video>
      {flash && (
        <div className="video-flash" role="status">
          {flash}
        </div>
      )}
      <VideoControls
        player={player}
        section={sectionState}
        sectionControl={!rangeMode}
        compact={compact}
        onToggleFullscreen={toggleFullscreen}
        onPointerEnter={() => setOverControls(true)}
        onPointerLeave={() => setOverControls(false)}
        portalContainer={root ?? undefined}
      />
    </div>
  )
}
