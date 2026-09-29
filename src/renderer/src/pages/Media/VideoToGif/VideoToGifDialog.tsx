import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import {
  GIF_PRESETS,
  MAX_CLIP_SECONDS,
  formatMegabytes,
  type GifPresetId,
  type GifSettings
} from './gifPresets'
import { useVideoToGif } from './useVideoToGif'
import '../../../components/ConfirmDialog/ConfirmDialog.css'
import './VideoToGifDialog.css'

interface VideoToGifDialogProps {
  video: MediaModel
  onClose: () => void
  onCreated: (gif: MediaModel, sizeBytes: number, settings: GifSettings) => void
}

const PRESET_IDS: GifPresetId[] = ['discord', 'x', 'gallery', 'custom']
const WIDTH_OPTIONS = [320, 480, 540, 640, 720, 960]
const FPS_OPTIONS = [10, 12, 15, 20, 24]

const round1 = (seconds: number): number => Math.round(seconds * 10) / 10

/**
 * Picks a clip (up to 10 s) of a video and a size preset, then encodes it to
 * a GIF saved next to the video with the same metadata. Every input is
 * locked while it runs; Cancel stops the encoding.
 */
export function VideoToGifDialog({
  video,
  onClose,
  onCreated
}: VideoToGifDialogProps): JSX.Element {
  const { t } = useTranslation()
  const titleId = useId()
  const previewRef = useRef<HTMLVideoElement>(null)
  const gif = useVideoToGif({
    video,
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

  const currentTime = (): number => round1(previewRef.current?.currentTime ?? 0)
  const frames = Math.max(0, Math.round((clip.end - clip.start) * settings.fps))

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

        <video
          ref={previewRef}
          className="video-gif-preview"
          src={toMediaUrl(video.route)}
          controls
          muted
          onLoadedMetadata={(e) => gif.setDuration(round1(e.currentTarget.duration))}
        />

        <fieldset className="video-gif-clip" disabled={busy}>
          <legend>{t('videoGif.clipLegend', { max: MAX_CLIP_SECONDS })}</legend>
          {(['start', 'end'] as const).map((edge) => (
            <div className="video-gif-edge" key={edge}>
              <label>
                <span>{t(`videoGif.${edge}`)}</span>
                <input
                  type="number"
                  min={0}
                  max={gif.duration ?? undefined}
                  step={0.1}
                  value={clip[edge]}
                  onChange={(e) => gif.setClip({ ...clip, [edge]: Number(e.target.value) })}
                />
              </label>
              <button
                type="button"
                className="btn"
                onClick={() => gif.setClip({ ...clip, [edge]: currentTime() })}
              >
                {t('videoGif.useCurrent')}
              </button>
            </div>
          ))}
          {gif.clipError && (
            <p className="video-gif-error" role="alert">
              {t(gif.clipError === 'order' ? 'videoGif.errorOrder' : 'videoGif.errorTooLong', {
                max: MAX_CLIP_SECONDS
              })}
            </p>
          )}
        </fieldset>

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
          <p className="video-gif-summary">
            {t('videoGif.summary', { width: settings.width, fps: settings.fps, frames })}
          </p>
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
