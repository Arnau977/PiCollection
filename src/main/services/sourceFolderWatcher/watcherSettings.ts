import { createJsonSettingsFile } from '../jsonSettingsFile'

export interface WatcherSettings {
  /** Add files saved into the source folder to Pending on their own. Off by default. */
  autoImport: boolean
  /**
   * When auto-import was last turned on: only files created at or after it
   * are imported, so the backlog already in the folder is never touched.
   */
  autoImportEnabledAt: number | null
}

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
