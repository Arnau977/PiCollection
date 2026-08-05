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

// Cached so that the hot path (a log call on every IPC round trip) is a
// single cheap check-and-return when disabled, not a synchronous file read.
let cachedEnabled: boolean | undefined

export function readLoggingEnabled(): boolean {
  if (cachedEnabled !== undefined) {
    return cachedEnabled
  }

  try {
    const raw = JSON.parse(
      readFileSync(loggingSettingsFilePath(), 'utf-8')
    ) as Partial<SavedLoggingSettings>
    cachedEnabled = raw.enabled === true
  } catch {
    // Missing or corrupted settings are expected on first run - default to disabled.
    cachedEnabled = false
  }

  return cachedEnabled
}

export function writeLoggingEnabled(enabled: boolean): void {
  try {
    writeFileSync(loggingSettingsFilePath(), JSON.stringify({ enabled }), 'utf-8')
    cachedEnabled = enabled
  } catch (err) {
    console.warn('Could not persist logging settings', err)
  }
}

/** Test-only: clears the in-module cache so a fresh per-test userData dir isn't shadowed. */
export function resetLoggingEnabledCache(): void {
  cachedEnabled = undefined
}
