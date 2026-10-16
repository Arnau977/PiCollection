import { useCallback, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import {
  GIF_PRESETS,
  LONG_CLIP_SECONDS,
  MAX_GIF_FPS,
  formatMegabytes,
  type GifPresetId,
  type GifSettings
} from './gifPresets'
import { useVideoToGif } from './useVideoToGif'
import { VideoPlayer, type Section } from '../../../components/VideoPlayer/VideoPlayer'
import '../../../components/ConfirmDialog/ConfirmDialog.css'
import './VideoToGifDialog.css'

interface VideoToGifDialogProps {
  video: MediaModel
  /** The section marked in the detail page's player: the clip starts as it. */
  initialClip?: Section | null
  onClose: () => void
  onCreated: (gif: MediaModel, sizeBytes: number, settings: GifSettings) => void
}

const PRESET_IDS: GifPresetId[] = ['discord', 'x', 'gallery', 'custom']
const WIDTH_OPTIONS = [320, 480, 540, 640, 720, 960]
const FPS_OPTIONS = [10, 12, 15, 20, 24]

const round1 = (seconds: number): number => Math.round(seconds * 10) / 10

/**
 * Picks a clip of a video (no length limit) on its player's timeline and a
 * size preset, then encodes it to
 * a GIF saved next to the video with the same metadata. Every input is
 * locked while it runs; Cancel stops the encoding.
 */
export function VideoToGifDialog({
  video,
  initialClip,
  onClose,
  onCreated
}: VideoToGifDialogProps): JSX.Element {
  const { t } = useTranslation()
  const titleId = useId()
  const gif = useVideoToGif({
    video,
    initialClip,
    onCreated,
    describeError: (code) =>
      code === 'video-unreadable' ? t('videoGif.errorUnreadable') : t('videoGif.errorEncoding')
  })
  const { clip, settings, state, busy } = gif

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return (): void => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onClose])

  const clipSeconds = Math.max(0, clip.end - clip.start)
  const { setDuration } = gif
  const onDurationChange = useCallback(
    (seconds: number | null) => {
      if (seconds !== null) setDuration(seconds)
    },
    [setDuration]
  )
  const summary =
    settings.width === 'source' || settings.fps === 'source'
      ? t('videoGif.summarySource', { maxFps: MAX_GIF_FPS })
      : t('videoGif.summary', {
          width: settings.width,
          fps: settings.fps,
          frames: Math.max(0, Math.round((clip.end - clip.start) * settings.fps))
        })

  function presetLabel(id: GifPresetId): string {
    if (id === 'custom') return t('videoGif.presetCustom')
    const preset = GIF_PRESETS[id]
    return preset.maxBytes
      ? t(`videoGif.preset.${id}`, { size: formatMegabytes(preset.maxBytes) })
      : t(`videoGif.preset.${id}`)
  }

  return (
    <div
      className="confirm-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="confirm-dialog video-gif-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h3 id={titleId} className="confirm-dialog-title">
          {t('videoGif.title')}
        </h3>

        {/* The clip is picked on the player's own timeline: its two markers
            are the start and end (drag them, or [ and ] at the current time),
            and playing previews the clip in a loop. */}
        <div className={busy ? 'video-gif-clip is-busy' : 'video-gif-clip'}>
          <VideoPlayer
            src={toMediaUrl(video.route)}
            muted
            className="video-gif-player"
            // Locked while converting: the clip being encoded can't change under it.
            rangeMode={{ value: clip, onChange: (next) => !busy && gif.setClip(next) }}
            onDurationChange={onDurationChange}
          />
          <p className="video-gif-clip-summary">
            {t('videoGif.clipSummary', {
              seconds: round1(clipSeconds),
              frames:
                settings.fps === 'source'
                  ? '…'
                  : Math.max(0, Math.round(clipSeconds * settings.fps))
            })}
          </p>
          {clipSeconds >= LONG_CLIP_SECONDS && (
            <p className="video-gif-long-note" role="status">
              {t('videoGif.longClipNote')}
            </p>
          )}
          {gif.clipError && (
            <p className="video-gif-error" role="alert">
              {t('videoGif.errorOrder')}
            </p>
          )}
        </div>

        <fieldset className="video-gif-presets" disabled={busy}>
          <legend>{t('videoGif.presetLegend')}</legend>
          <div className="video-gif-preset-options">
            {PRESET_IDS.map((id) => (
              <label
                key={id}
                className={gif.preset === id ? 'video-gif-preset active' : 'video-gif-preset'}
              >
                <input
                  type="radio"
                  name="video-gif-preset"
                  value={id}
                  checked={gif.preset === id}
                  onChange={() => gif.setPreset(id)}
                />
                {presetLabel(id)}
              </label>
            ))}
          </div>
          {gif.preset === 'custom' && (
            <div className="video-gif-custom">
              <label>
                <span>{t('videoGif.width')}</span>
                <select
                  value={gif.custom.width}
                  onChange={(e) => gif.setCustom({ ...gif.custom, width: Number(e.target.value) })}
                >
                  {WIDTH_OPTIONS.map((width) => (
                    <option key={width} value={width}>
                      {width} px
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t('videoGif.fps')}</span>
                <select
                  value={gif.custom.fps}
                  onChange={(e) => gif.setCustom({ ...gif.custom, fps: Number(e.target.value) })}
                >
                  {FPS_OPTIONS.map((fps) => (
                    <option key={fps} value={fps}>
                      {fps} fps
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <p className="video-gif-summary">{summary}</p>
        </fieldset>

        {state.kind === 'encoding' && (
          <div className="video-gif-progress">
            <progress
              max={state.progress.total}
              value={state.progress.done}
              aria-label={t('videoGif.progressLabel')}
            />
            <p role="status">
              {state.progress.previousBytes && settings.maxBytes
                ? t('videoGif.retrying', {
                    size: formatMegabytes(state.progress.previousBytes),
                    limit: formatMegabytes(settings.maxBytes),
                    width: state.progress.width
                  })
                : t('videoGif.encoding', {
                    done: state.progress.done,
                    total: state.progress.total
                  })}
            </p>
          </div>
        )}
        {state.kind === 'saving' && <p role="status">{t('videoGif.saving')}</p>}
        {state.kind === 'error' && (
          <p className="video-gif-error" role="alert">
            {state.message}
          </p>
        )}

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="btn"
            onClick={state.kind === 'encoding' ? gif.cancel : onClose}
            disabled={state.kind === 'saving'}
          >
            {t(state.kind === 'encoding' ? 'videoGif.stop' : 'confirmDialog.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void gif.start()}
            disabled={busy || gif.clipError !== null || gif.duration === null}
          >
            {t('videoGif.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
