import { app } from 'electron'
import { join } from 'path'
import { isAbsolute, normalize } from 'path'
import { isPathUnderRoot, withTrailingSeparator } from './pathPrefix'
import { createJsonSettingsFile } from './jsonSettingsFile'

const SETTINGS_FILE = 'source-folder-settings.json'

export function sourceFolderSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

// write() below persists the path itself (createJsonSettingsFile stores
// exactly what it's given, not wrapped in an object), so parse must read
// the same shape back - not a `{ path: ... }` wrapper that was never
// actually written.
const settingsFile = createJsonSettingsFile<string | null>(
  SETTINGS_FILE,
  (raw) => (typeof raw === 'string' && raw.trim() ? raw.trim() : null),
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
