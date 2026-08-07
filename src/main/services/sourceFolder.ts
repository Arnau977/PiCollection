import { app } from 'electron'
import { join } from 'path'
import { isAbsolute, normalize } from 'path'
import { isPathUnderRoot, withTrailingSeparator } from './pathPrefix'
import { createJsonSettingsFile } from './jsonSettingsFile'

const SETTINGS_FILE = 'source-folder-settings.json'

interface SavedSourceFolderSettings {
  path?: string
}

export function sourceFolderSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

const settingsFile = createJsonSettingsFile<string | null>(
  SETTINGS_FILE,
  (raw) => {
    const path = (raw as Partial<SavedSourceFolderSettings>).path
    return typeof path === 'string' && path.trim() ? path.trim() : null
  },
  null
)

export function readSourceFolder(): string | null {
  return settingsFile.read()
}

export function writeSourceFolder(path: string | null): void {
  const trimmed = path?.trim()
  settingsFile.write(trimmed || null)
}

/** Test-only: clears the in-module cache so a fresh per-test userData dir isn't shadowed. */
export function resetSourceFolderCache(): void {
  settingsFile.invalidate()
}

/** An already-absolute route is trusted as-is; a relative one is joined onto the configured source folder. */
export function resolveRoute(route: string, sourceFolder: string | null | undefined): string {
  if (isAbsolute(route)) return normalize(route)
  if (sourceFolder) return join(sourceFolder, route)
  return route
}

/** The inverse of resolveRoute: only strips the source folder prefix when the absolute path actually falls under it. */
export function relativizeRoute(
  absolutePath: string,
  sourceFolder: string | null | undefined
): string {
  if (!sourceFolder || !isPathUnderRoot(absolutePath, sourceFolder)) return absolutePath
  return absolutePath.slice(withTrailingSeparator(sourceFolder).length)
}
