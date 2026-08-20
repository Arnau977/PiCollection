import { app } from 'electron'
import { join } from 'path'
import { createJsonSettingsFile } from '../services/jsonSettingsFile'

const SETTINGS_FILE = 'logging-settings.json'

export function loggingSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

// write() below persists the flag itself (createJsonSettingsFile stores
// exactly what it's given, not wrapped in an object), so parse must read
// the same shape back - not a `{ enabled: ... }` wrapper that was never
// actually written.
const settingsFile = createJsonSettingsFile<boolean>(SETTINGS_FILE, (raw) => raw === true, false)

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
