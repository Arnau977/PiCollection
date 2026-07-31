import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const SETTINGS_FILE = 'sauce-nao-settings.json'

interface SavedSauceNaoSettings {
  apiKey?: string
}

function settingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

export function readSauceNaoApiKey(): string | undefined {
  try {
    const raw = JSON.parse(
      readFileSync(settingsFilePath(), 'utf-8')
    ) as Partial<SavedSauceNaoSettings>
    return typeof raw.apiKey === 'string' && raw.apiKey.trim() ? raw.apiKey.trim() : undefined
  } catch {
    // Missing or corrupted settings are expected on first run - no key saved.
    return undefined
  }
}

export function writeSauceNaoApiKey(apiKey: string | undefined): void {
  try {
    const trimmed = apiKey?.trim()
    writeFileSync(settingsFilePath(), JSON.stringify({ apiKey: trimmed || undefined }), 'utf-8')
  } catch (err) {
    console.warn('Could not persist SauceNAO settings', err)
  }
}
