/** `stable` tracks tagged releases (e.g. `v1.2.0`); `beta` also tracks prereleases (e.g. `v1.2.0-beta.1`). */
export type UpdateChannel = 'stable' | 'beta'

export type UpdaterEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string; highlights: string | null }
  | { type: 'not-available' }
  | { type: 'download-progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
