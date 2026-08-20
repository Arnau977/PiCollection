import { app } from 'electron'
import { join } from 'path'
import { createJsonSettingsFile } from '../jsonSettingsFile'

const SETTINGS_FILE = 'sauce-nao-settings.json'

export function sauceNaoSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

// Uses `null` (not `undefined`) as the internal "cleared" value: the shared
// helper's cache sentinel is `cached !== undefined`, so a legitimate stored
// value of `undefined` would be indistinguishable from "not yet cached" -
// the same pitfall already worked around in sourceFolder.ts. `undefined`
// also can't round-trip through `JSON.stringify` at the top level (it
// produces the value `undefined`, not the string `"undefined"`), which
// would make every write() that clears the key throw.
//
// write() below persists the key itself (createJsonSettingsFile stores
// exactly what it's given, not wrapped in an object), so parse must read
// the same shape back - not a `{ apiKey: ... }` wrapper that was never
// actually written.
const settingsFile = createJsonSettingsFile<string | null>(
  SETTINGS_FILE,
  (raw) => (typeof raw === 'string' && raw.trim() ? raw.trim() : null),
  null
)

export function readSauceNaoApiKey(): string | undefined {
  return settingsFile.read() ?? undefined
}

export function writeSauceNaoApiKey(apiKey: string | undefined): void {
  const trimmed = apiKey?.trim()
  settingsFile.write(trimmed || null)
}

/** Test-only: clears the in-module cache so a fresh per-test userData dir isn't shadowed. */
export function resetSauceNaoApiKeyCache(): void {
  settingsFile.invalidate()
}
