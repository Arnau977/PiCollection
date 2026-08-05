import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const SETTINGS_FILE = 'logging-settings.json'

interface SavedLoggingSettings {
  enabled: boolean
}

export function loggingSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

export function readLoggingEnabled(): boolean {
  try {
    const raw = JSON.parse(
      readFileSync(loggingSettingsFilePath(), 'utf-8')
    ) as Partial<SavedLoggingSettings>
    return raw.enabled === true
  } catch {
    // Missing or corrupted settings are expected on first run - default to disabled.
    return false
  }
}

export function writeLoggingEnabled(enabled: boolean): void {
  try {
    writeFileSync(loggingSettingsFilePath(), JSON.stringify({ enabled }), 'utf-8')
  } catch (err) {
    console.warn('Could not persist logging settings', err)
  }
}
