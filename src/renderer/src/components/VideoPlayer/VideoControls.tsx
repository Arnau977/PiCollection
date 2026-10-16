import { useTranslation } from 'react-i18next'
import {
  Maximize,
  Minimize,
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
  MenuTrigger,
  Popover,
  Slider,
  SliderThumb,
  SliderTrack
} from 'react-aria-components'
import type { VideoPlayerState } from './useVideoPlayer'
import { VideoTimeline } from './VideoTimeline'
import { formatTime } from './formatTime'
import { PLAYER_SHORTCUT_LABELS, type PlayerAction } from './usePlayerShortcuts'
import { PLAYBACK_RATES, SKIP_SECONDS } from './playerConstants'

interface VideoControlsProps {
  player: VideoPlayerState
  compact: boolean
  onToggleFullscreen: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}

/** The floating pill: transport, timeline, loop, speed, volume, fullscreen. */
export function VideoControls({
  player,
  compact,
  onToggleFullscreen,
  onPointerEnter,
  onPointerLeave
}: VideoControlsProps): JSX.Element {
  const { t } = useTranslation()

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

  return (
    <div className="video-controls" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <VideoTimeline
        currentTime={player.currentTime}
        duration={player.duration}
        onSeek={player.seek}
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
        <MenuTrigger>
          <Button className="video-ctrl video-ctrl-text" aria-label={t('videoPlayer.speed')}>
            {player.rate === 1 ? '1×' : `${player.rate}×`}
          </Button>
          <Popover placement="top" className="video-menu-popover">
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
