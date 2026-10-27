export const VIDEO_PLAYER_STORAGE_KEY = 'picollection:video-player'

/** What carries over from one video to the next. Speed deliberately doesn't. */
export interface VideoPlayerPrefs {
  loop: boolean
  volume: number
  muted: boolean
}

const DEFAULTS: VideoPlayerPrefs = { loop: false, volume: 1, muted: false }

export function loadVideoPlayerPrefs(): VideoPlayerPrefs {
  try {
    const raw = window.localStorage.getItem(VIDEO_PLAYER_STORAGE_KEY)
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw) as Partial<VideoPlayerPrefs>
    // Saved before mute meant volume 0: read it as muted, unmuting to full.
    if (saved.volume === 0)
      return { loop: saved.loop === true, volume: DEFAULTS.volume, muted: true }
    return {
      loop: saved.loop === true,
      volume:
        typeof saved.volume === 'number' && saved.volume >= 0 && saved.volume <= 1
          ? saved.volume
          : DEFAULTS.volume,
      muted: saved.muted === true
    }
  } catch {
    return DEFAULTS
  }
}

export function saveVideoPlayerPrefs(prefs: VideoPlayerPrefs): void {
  try {
    window.localStorage.setItem(VIDEO_PLAYER_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage full or blocked: the preference just isn't remembered.
  }
}
