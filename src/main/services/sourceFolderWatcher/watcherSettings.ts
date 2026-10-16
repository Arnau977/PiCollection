import type { WatcherSettings } from '@shared/models'
import { createJsonSettingsFile } from '../jsonSettingsFile'

const DEFAULTS: WatcherSettings = { autoImport: false, autoImportEnabledAt: null }

function parse(raw: unknown): WatcherSettings {
  const saved = (raw ?? {}) as Partial<WatcherSettings>
  return {
    autoImport: saved.autoImport === true,
    autoImportEnabledAt:
      typeof saved.autoImportEnabledAt === 'number' ? saved.autoImportEnabledAt : null
  }
}

const settingsFile = createJsonSettingsFile('source-folder-watcher-settings.json', parse, DEFAULTS)

export function readWatcherSettings(): WatcherSettings {
  return settingsFile.read()
}

/** Turning it on (again) moves the cutoff to now; turning it off keeps it. */
export function setAutoImport(enabled: boolean, now: number = Date.now()): WatcherSettings {
  const current = settingsFile.read()
  const next: WatcherSettings = enabled
    ? { autoImport: true, autoImportEnabledAt: now }
    : { ...current, autoImport: false }
  settingsFile.write(next)
  return next
}

/** Test-only. */
export function resetWatcherSettingsCache(): void {
  settingsFile.invalidate()
}
