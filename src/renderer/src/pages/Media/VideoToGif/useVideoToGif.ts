import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import {
  DEFAULT_CUSTOM_SETTINGS,
  GIF_PRESETS,
  DEFAULT_CLIP_SECONDS,
  type GifPresetId,
  type GifSettings
} from './gifPresets'
import { convertVideoToGif, type Clip, type GifProgress } from './videoToGif'

export type ConvertState =
  | { kind: 'idle' }
  | { kind: 'encoding'; progress: GifProgress }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }

export interface VideoToGif {
  clip: Clip
  setClip: (clip: Clip) => void
  duration: number | null
  setDuration: (seconds: number) => void
  preset: GifPresetId
  setPreset: (preset: GifPresetId) => void
  custom: GifSettings
  setCustom: (settings: GifSettings) => void
  settings: GifSettings
  /** Why the clip can't be converted as set, or null when it can. */
  clipError: 'order' | null
  state: ConvertState
  busy: boolean
  start: () => Promise<void>
  cancel: () => void
}

interface UseVideoToGifArgs {
  video: MediaModel
  /** The section marked in the player, if any: the clip starts as that. */
  initialClip?: Clip | null
  /** `sizeBytes` may still exceed the preset's limit if the GIF couldn't shrink enough. */
  onCreated: (gif: MediaModel, sizeBytes: number, settings: GifSettings) => void
  /** Maps an internal error code to a message for the user. */
  describeError: (code: string) => string
}

export function useVideoToGif({
  video,
  initialClip,
  onCreated,
  describeError
}: UseVideoToGifArgs): VideoToGif {
  const [clip, setClip] = useState<Clip>(initialClip ?? { start: 0, end: DEFAULT_CLIP_SECONDS })
  const [duration, setDurationState] = useState<number | null>(null)
  const [preset, setPreset] = useState<GifPresetId>('discord')
  const [custom, setCustom] = useState<GifSettings>(DEFAULT_CUSTOM_SETTINGS)
  const [state, setState] = useState<ConvertState>({ kind: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  // A conversion still running when the dialog goes away is just dropped.
  useEffect(() => (): void => abortRef.current?.abort(), [])

  // Stable: the player reports the duration through an effect that depends on it.
  const setDuration = useCallback((seconds: number): void => {
    setDurationState(seconds)
    // Kept inside the video (a short video can be shorter than the default).
    setClip((prev) => ({
      start: Math.min(prev.start, seconds),
      end: Math.min(prev.end, seconds)
    }))
  }, [])

  const settings = preset === 'custom' ? custom : GIF_PRESETS[preset]
  // No length cap: long clips only get a note in the dialog.
  const clipError = clip.end <= clip.start ? 'order' : null
  const busy = state.kind === 'encoding' || state.kind === 'saving'

  async function start(): Promise<void> {
    if (busy || clipError) return
    const controller = new AbortController()
    abortRef.current = controller
    setState({
      kind: 'encoding',
      progress: { done: 0, total: 1, width: 0, attempt: 1 }
    })
    try {
      const gif = await convertVideoToGif(
        toMediaUrl(video.route),
        clip,
        settings,
        (progress) => setState({ kind: 'encoding', progress }),
        controller.signal
      )
      setState({ kind: 'saving' })
      const result = await window.api.media.createGifFromVideo(video.id, gif.bytes)
      if (!result.success) {
        setState({ kind: 'error', message: result.error.message })
        return
      }
      setState({ kind: 'idle' })
      onCreated(result.data, gif.bytes.length, settings)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setState({ kind: 'idle' })
        return
      }
      setState({ kind: 'error', message: describeError(err instanceof Error ? err.message : '') })
    } finally {
      abortRef.current = null
    }
  }

  function cancel(): void {
    abortRef.current?.abort()
  }

  return {
    clip,
    setClip,
    duration,
    setDuration,
    preset,
    setPreset,
    custom,
    setCustom,
    settings,
    clipError,
    state,
    busy,
    start,
    cancel
  }
}
