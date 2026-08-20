import { app } from 'electron'
import { join } from 'path'
import { createJsonSettingsFile } from './jsonSettingsFile'

const SETTINGS_FILE = 'danbooru-settings.json'

export interface StoredDanbooruCredentials {
  username: string
  apiKey: string
  userId: number
}

export function danbooruSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

function parse(raw: unknown): StoredDanbooruCredentials | null {
  const saved = raw as Partial<StoredDanbooruCredentials>
  if (
    typeof saved.username === 'string' &&
    saved.username.trim() &&
    typeof saved.apiKey === 'string' &&
    saved.apiKey.trim() &&
    typeof saved.userId === 'number'
  ) {
    return { username: saved.username.trim(), apiKey: saved.apiKey.trim(), userId: saved.userId }
  }
  return null
}

const settingsFile = createJsonSettingsFile<StoredDanbooruCredentials | null>(
  SETTINGS_FILE,
  parse,
  null
)

export function readDanbooruCredentials(): StoredDanbooruCredentials | undefined {
  return settingsFile.read() ?? undefined
}

export function writeDanbooruCredentials(credentials: StoredDanbooruCredentials | undefined): void {
  settingsFile.write(credentials ?? null)
}

/** Test-only: clears the in-module cache so a fresh per-test userData dir isn't shadowed. */
export function resetDanbooruCredentialsCache(): void {
  settingsFile.invalidate()
}
