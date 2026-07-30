import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { UpdateChannel } from '@shared/models'

const SETTINGS_FILE = 'updater-settings.json'
const DEFAULT_CHANNEL: UpdateChannel = 'stable'

interface SavedUpdaterSettings {
  channel: UpdateChannel
}

function settingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

export function readUpdateChannel(): UpdateChannel {
  try {
    const raw = JSON.parse(
      readFileSync(settingsFilePath(), 'utf-8')
    ) as Partial<SavedUpdaterSettings>
    return raw.channel === 'beta' ? 'beta' : DEFAULT_CHANNEL
  } catch {
    // Missing or corrupted settings are expected on first run - default to stable.
    return DEFAULT_CHANNEL
  }
}

export function writeUpdateChannel(channel: UpdateChannel): void {
  try {
    writeFileSync(settingsFilePath(), JSON.stringify({ channel }), 'utf-8')
  } catch (err) {
    console.warn('Could not persist updater settings', err)
  }
}
