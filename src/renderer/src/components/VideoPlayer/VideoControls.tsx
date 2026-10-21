import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Brackets,
  Camera,
  Check,
  Maximize,
  Minimize,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX
} from 'lucide-react'
import {
  Button,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Separator,
  Slider,
  SliderThumb,
  SliderTrack
} from 'react-aria-components'
import type { VideoPlayerState } from './useVideoPlayer'
import type { UseSection } from './useSection'
import { VideoTimeline } from './VideoTimeline'
import { formatTime } from './formatTime'
import { PLAYER_SHORTCUT_LABELS, type PlayerAction } from './usePlayerShortcuts'
import { PLAYBACK_RATES, SKIP_SECONDS, VOLUME_STEP } from './playerConstants'

interface VideoControlsProps {
  player: VideoPlayerState
  section: UseSection
  /** The "Loop section" control; off in range mode, where the range is the clip. */
  sectionControl?: boolean
  compact: boolean
  onToggleFullscreen: () => void
  /** Copies the frame on screen; resolves false if it couldn't. */
  onCopyFrame: () => Promise<boolean>
  onPointerEnter: () => void
  onPointerLeave: () => void
  /** Where popovers (the speed menu) render: the player root, so they still
   *  show in full screen, where only the fullscreen element is painted. */
  portalContainer?: HTMLElement
}

/** The floating pill: transport, timeline, loop, speed, volume, fullscreen. */
export function VideoControls({
  player,
  section,
  sectionControl = true,
  compact,
  onToggleFullscreen,
  onCopyFrame,
  onPointerEnter,
  onPointerLeave,
  portalContainer
}: VideoControlsProps): JSX.Element {
  const { t } = useTranslation()
  const [volumeHover, setVolumeHover] = useState(false)
  const [frameCopied, setFrameCopied] = useState(false)
  // Esc hides the popped-up volume slider (WCAG 1.4.13) until the pointer
  // or focus leaves the volume control.
  const [volumeDismissed, setVolumeDismissed] = useState(false)
  useEffect(() => {
    if (!volumeHover) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setVolumeDismissed(true)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return (): void => window.removeEventListener('keydown', onKeyDown, true)
  }, [volumeHover])
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => (): void => clearTimeout(copiedTimer.current), [])

  async function copyFrame(): Promise<void> {
    if (!(await onCopyFrame())) return
    setFrameCopied(true)
    clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setFrameCopied(false), 2000)
  }
  const copyFrameLabel = t(frameCopied ? 'videoPlayer.frameCopied' : 'videoPlayer.copyFrame')

  // Name for screen readers; tooltip and aria-keyshortcuts carry the key.
  function shortcutProps(label: string, action: PlayerAction): Record<string, string> {
    const key = PLAYER_SHORTCUT_LABELS[action]
    return {
      'aria-label': label,
      title: t('videoPlayer.withShortcut', { label, key: key === ' ' ? 'Space' : key }),
      'aria-keyshortcuts': key
    }
  }

  const rateLabel = (rate: number): string => (rate === 1 ? t('videoPlayer.normal') : `${rate}×`)

  // The section control cycles: mark A, then B, then clear.
  const sectionLabel = t(
    section.section
      ? 'videoPlayer.clearSection'
      : section.pendingStart !== null
        ? 'videoPlayer.setSectionEnd'
        : 'videoPlayer.loopSection'
  )
  const sectionShortcut: PlayerAction = section.section
    ? 'clearSection'
    : section.pendingStart !== null
      ? 'setB'
      : 'setA'
  function sectionAction(): void {
    const time = player.currentTime
    if (section.section) section.clear()
    else if (section.pendingStart !== null) section.setB(time)
    else section.setA(time)
  }

  return (
    <div className="video-controls" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <VideoTimeline
        currentTime={player.currentTime}
        duration={player.duration}
        onSeek={player.seek}
        section={section.section}
        pendingStart={section.pendingStart}
        onSectionChange={section.setSection}
      />
      <div className="video-controls-row">
        <button
          type="button"
          className="video-ctrl"
          onClick={player.togglePlay}
          {...shortcutProps(
            t(player.playing ? 'videoPlayer.pause' : 'videoPlayer.play'),
            'togglePlay'
          )}
        >
          {player.playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          className="video-ctrl"
          onClick={() => player.skip(-SKIP_SECONDS)}
          {...shortcutProps(t('videoPlayer.back'), 'back')}
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          className="video-ctrl"
          onClick={() => player.skip(SKIP_SECONDS)}
          {...shortcutProps(t('videoPlayer.forward'), 'forward')}
        >
          <RotateCw size={16} />
        </button>
        <span className="video-time">
          {formatTime(player.currentTime)} / {formatTime(player.duration)}
        </span>

        <span className="video-controls-spacer" />

        {!compact && (
          <button
            type="button"
            className="video-ctrl"
            aria-label={copyFrameLabel}
            title={copyFrameLabel}
            onClick={() => void copyFrame()}
          >
            {frameCopied ? <Check size={16} /> : <Camera size={16} />}
          </button>
        )}

        <button
          type="button"
          className="video-ctrl"
          aria-pressed={player.loop}
          onClick={() => player.setLoop(!player.loop)}
          {...shortcutProps(t('videoPlayer.loop'), 'loop')}
        >
          <Repeat size={16} />
        </button>
        {compact ? (
          // The narrow edit-form preview folds speed and the one-off actions
          // into one menu instead of more pill buttons: speed under its own
          // heading, the actions after a separator.
          <MenuTrigger>
            <Button className="video-ctrl" aria-label={t('videoPlayer.more')}>
              <MoreHorizontal size={16} />
            </Button>
            <Popover
              placement="top"
              className="video-menu-popover"
              UNSTABLE_portalContainer={portalContainer}
            >
              <Menu
                className="video-menu"
                aria-label={t('videoPlayer.more')}
                onAction={(key) => {
                  if (key === 'section') sectionAction()
                  else if (key === 'copyFrame') void copyFrame()
                }}
              >
                <MenuSection
                  aria-label={t('videoPlayer.speed')}
                  selectionMode="single"
                  selectedKeys={[String(player.rate)]}
                  onSelectionChange={(keys) => {
                    const [key] = [...(keys as Set<string>)]
                    if (key) player.setRate(Number(key))
                  }}
                >
                  <Header className="video-menu-header">{t('videoPlayer.speed')}</Header>
                  {PLAYBACK_RATES.map((rate) => (
                    <MenuItem
                      key={rate}
                      id={String(rate)}
                      className="video-menu-item"
                      textValue={rateLabel(rate)}
                    >
                      {rateLabel(rate)}
                    </MenuItem>
                  ))}
                </MenuSection>
                <Separator className="video-menu-separator" />
                <MenuSection aria-label={t('videoPlayer.actions')}>
                  {sectionControl && (
                    <MenuItem id="section" className="video-menu-item" textValue={sectionLabel}>
                      <Brackets size={14} aria-hidden="true" />
                      {sectionLabel}
                    </MenuItem>
                  )}
                  <MenuItem id="copyFrame" className="video-menu-item" textValue={copyFrameLabel}>
                    <Camera size={14} aria-hidden="true" />
                    {copyFrameLabel}
                  </MenuItem>
                </MenuSection>
              </Menu>
            </Popover>
          </MenuTrigger>
        ) : (
          <>
            {/* An action button named for what it does next (no pressed
                state: its label already changes A -> B -> clear). */}
            {sectionControl && (
              <button
                type="button"
                className="video-ctrl"
                onClick={sectionAction}
                {...shortcutProps(sectionLabel, sectionShortcut)}
              >
                <Brackets size={16} />
              </button>
            )}
            <MenuTrigger>
              <Button className="video-ctrl video-ctrl-text" aria-label={t('videoPlayer.speed')}>
                {player.rate === 1 ? '1×' : `${player.rate}×`}
              </Button>
              <Popover
                placement="top"
                className="video-menu-popover"
                UNSTABLE_portalContainer={portalContainer}
              >
                <Menu
                  className="video-menu"
                  aria-label={t('videoPlayer.speed')}
                  selectionMode="single"
                  selectedKeys={[String(player.rate)]}
                  onAction={(key) => player.setRate(Number(key))}
                >
                  {PLAYBACK_RATES.map((rate) => (
                    <MenuItem
                      key={rate}
                      id={String(rate)}
                      className="video-menu-item"
                      textValue={rateLabel(rate)}
                    >
                      {rateLabel(rate)}
                    </MenuItem>
                  ))}
                </Menu>
              </Popover>
            </MenuTrigger>
          </>
        )}
        {/* Hovering the volume control shows its level, like the timeline shows
            the time under the pointer. Where the pill is narrow (compact, or
            below 900px) the slider pops up above the button on hover or
            keyboard focus instead of sitting in the row (CSS). */}
        <span
          className="video-volume-group"
          data-dismissed={volumeDismissed || undefined}
          onPointerEnter={() => setVolumeHover(true)}
          onPointerLeave={() => {
            setVolumeHover(false)
            setVolumeDismissed(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setVolumeDismissed(true)
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setVolumeDismissed(false)
          }}
        >
          {volumeHover && !volumeDismissed && (
            <span className="video-volume-level" aria-hidden="true">
              {Math.round((player.muted ? 0 : player.volume) * 100)}%
            </span>
          )}
          <button
            type="button"
            className="video-ctrl"
            onClick={player.toggleMute}
            {...shortcutProps(t(player.muted ? 'videoPlayer.unmute' : 'videoPlayer.mute'), 'mute')}
          >
            {player.muted || player.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <Slider
            aria-label={t('videoPlayer.volume')}
            className="video-volume"
            minValue={0}
            maxValue={1}
            step={VOLUME_STEP}
            value={player.muted ? 0 : player.volume}
            onChange={(value) => player.setVolume(value as number)}
          >
            <SliderTrack className="video-volume-track">
              {({ state }) => (
                <>
                  <div
                    className="video-timeline-fill"
                    style={{ width: `${state.getThumbPercent(0) * 100}%` }}
                  />
                  <SliderThumb className="video-timeline-thumb" />
                </>
              )}
            </SliderTrack>
          </Slider>
        </span>
        <button
          type="button"
          className="video-ctrl"
          onClick={onToggleFullscreen}
          {...shortcutProps(
            t(player.fullscreen ? 'videoPlayer.exitFullscreen' : 'videoPlayer.fullscreen'),
            'fullscreen'
          )}
        >
          {player.fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>
    </div>
  )
}
