import { useCallback, useEffect, useRef, useState } from 'react'
import { useVideoPlayer } from './useVideoPlayer'
import { usePlayerShortcuts } from './usePlayerShortcuts'
import { getInputModality } from './inputModality'
import { VideoControls } from './VideoControls'
import { SKIP_SECONDS } from './playerConstants'
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
  rangeMode?: { value: Section; onChange: (section: Section) => void }
}

const HIDE_AFTER_MS = 2000

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
  className
}: VideoPlayerProps): JSX.Element {
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

  usePlayerShortcuts(rootRef, {
    togglePlay: player.togglePlay,
    back: () => player.skip(-SKIP_SECONDS),
    forward: () => player.skip(SKIP_SECONDS),
    loop: () => player.setLoop(!player.loop),
    mute: player.toggleMute,
    fullscreen: toggleFullscreen
  })

  function nudge(): void {
    setRecentlyMoved(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setRecentlyMoved(false), HIDE_AFTER_MS)
  }

  useEffect(
    () => (): void => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    []
  )

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
      <VideoControls
        player={player}
        compact={compact}
        onToggleFullscreen={toggleFullscreen}
        onPointerEnter={() => setOverControls(true)}
        onPointerLeave={() => setOverControls(false)}
        portalContainer={root ?? undefined}
      />
    </div>
  )
}
