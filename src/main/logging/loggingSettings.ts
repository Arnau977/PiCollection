import { app } from 'electron'
import { join } from 'path'
import { createJsonSettingsFile } from '../services/jsonSettingsFile'

const SETTINGS_FILE = 'logging-settings.json'

interface SavedLoggingSettings {
  enabled: boolean
}

export function loggingSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

const settingsFile = createJsonSettingsFile<boolean>(
  SETTINGS_FILE,
  (raw) => (raw as Partial<SavedLoggingSettings>).enabled === true,
  false
)

export function readLoggingEnabled(): boolean {
  return settingsFile.read()
}

export function writeLoggingEnabled(enabled: boolean): void {
  settingsFile.write(enabled)
}

/** Test-only: clears the in-module cache so a fresh per-test userData dir isn't shadowed. */
export function resetLoggingEnabledCache(): void {
  settingsFile.invalidate()
}
