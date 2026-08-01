import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { isAbsolute, join, normalize } from 'path'
import { isPathUnderRoot, withTrailingSeparator } from './pathPrefix'

const SETTINGS_FILE = 'source-folder-settings.json'

interface SavedSourceFolderSettings {
  path?: string
}

export function sourceFolderSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

export function readSourceFolder(): string | null {
  try {
    const raw = JSON.parse(
      readFileSync(sourceFolderSettingsFilePath(), 'utf-8')
    ) as Partial<SavedSourceFolderSettings>
    return typeof raw.path === 'string' && raw.path.trim() ? raw.path.trim() : null
  } catch {
    // Missing or corrupted settings are expected when no source folder was
    // ever configured - every caller treats that exactly like "absolute
    // paths only", today's default behavior.
    return null
  }
}

export function writeSourceFolder(path: string | null): void {
  try {
    const trimmed = path?.trim()
    writeFileSync(
      sourceFolderSettingsFilePath(),
      JSON.stringify({ path: trimmed || undefined }),
      'utf-8'
    )
  } catch (err) {
    console.warn('Could not persist source folder settings', err)
  }
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
