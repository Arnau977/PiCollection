import { app } from 'electron'
import { join } from 'path'
import type { UpdateChannel } from '@shared/models'
import { createJsonSettingsFile } from '../services/jsonSettingsFile'

const SETTINGS_FILE = 'updater-settings.json'
const DEFAULT_CHANNEL: UpdateChannel = 'stable'

export function updaterSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

// write() below persists the channel itself (createJsonSettingsFile stores
// exactly what it's given, not wrapped in an object), so parse must read
// the same shape back - not a `{ channel: ... }` wrapper that was never
// actually written.
const settingsFile = createJsonSettingsFile<UpdateChannel>(
  SETTINGS_FILE,
  (raw) => (raw === 'beta' ? 'beta' : DEFAULT_CHANNEL),
  DEFAULT_CHANNEL
)

export function readUpdateChannel(): UpdateChannel {
  return settingsFile.read()
}

export function writeUpdateChannel(channel: UpdateChannel): void {
  settingsFile.write(channel)
}

/** Test-only: clears the in-module cache so a fresh per-test userData dir isn't shadowed. */
export function resetUpdateChannelCache(): void {
  settingsFile.invalidate()
}
