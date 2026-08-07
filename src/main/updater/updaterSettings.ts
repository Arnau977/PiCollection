import { app } from 'electron'
import { join } from 'path'
import type { UpdateChannel } from '@shared/models'
import { createJsonSettingsFile } from '../services/jsonSettingsFile'

const SETTINGS_FILE = 'updater-settings.json'
const DEFAULT_CHANNEL: UpdateChannel = 'stable'

interface SavedUpdaterSettings {
  channel: UpdateChannel
}

export function updaterSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

const settingsFile = createJsonSettingsFile<UpdateChannel>(
  SETTINGS_FILE,
  (raw) => ((raw as Partial<SavedUpdaterSettings>).channel === 'beta' ? 'beta' : DEFAULT_CHANNEL),
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
