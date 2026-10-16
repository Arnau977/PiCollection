import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Brackets,
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
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Slider,
  SliderThumb,
  SliderTrack
} from 'react-aria-components'
import type { VideoPlayerState } from './useVideoPlayer'
import type { UseSection } from './useSection'
import { VideoTimeline } from './VideoTimeline'
import { formatTime } from './formatTime'
import { PLAYER_SHORTCUT_LABELS, type PlayerAction } from './usePlayerShortcuts'
import { PLAYBACK_RATES, SKIP_SECONDS } from './playerConstants'

interface VideoControlsProps {
  player: VideoPlayerState
  section: UseSection
  compact: boolean
  onToggleFullscreen: () => void
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
  compact,
  onToggleFullscreen,
  onPointerEnter,
  onPointerLeave,
  portalContainer
}: VideoControlsProps): JSX.Element {
  const { t } = useTranslation()
  const [volumeHover, setVolumeHover] = useState(false)

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
          // The narrow edit-form preview folds speed and the section into one
          // menu, as the spec asks, instead of two more pill buttons.
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
                <MenuSection aria-label={t('videoPlayer.loopSection')}>
                  <MenuItem id="section" className="video-menu-item" textValue={sectionLabel}>
                    {sectionLabel}
                  </MenuItem>
                </MenuSection>
              </Menu>
            </Popover>
          </MenuTrigger>
        ) : (
          <>
            {/* An action button named for what it does next (no pressed
                state: its label already changes A -> B -> clear). */}
            <button
              type="button"
              className="video-ctrl"
              onClick={sectionAction}
              {...shortcutProps(sectionLabel, sectionShortcut)}
            >
              <Brackets size={16} />
            </button>
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
            the time under the pointer. */}
        <span
          className="video-volume-group"
          onPointerEnter={() => setVolumeHover(true)}
          onPointerLeave={() => setVolumeHover(false)}
        >
          {volumeHover && (
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
          {!compact && (
            <Slider
              aria-label={t('videoPlayer.volume')}
              className="video-volume"
              minValue={0}
              maxValue={1}
              step={0.05}
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
          )}
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
