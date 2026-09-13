import { app } from 'electron'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { createJsonSettingsFile } from './jsonSettingsFile'

const SETTINGS_FILE = 'extension-bridge-settings.json'
const DEFAULT_PORT = 8934

export interface ExtensionBridgeSettings {
  enabled: boolean
  /** Empty string means "never generated yet" - ensureExtensionBridgeToken() fills it in on first enable. */
  token: string
  port: number
  backgroundModeEnabled: boolean
}

export function extensionBridgeSettingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

const DEFAULT_SETTINGS: ExtensionBridgeSettings = {
  enabled: false,
  token: '',
  port: DEFAULT_PORT,
  backgroundModeEnabled: false
}

function parse(raw: unknown): ExtensionBridgeSettings {
  const saved = raw as Partial<ExtensionBridgeSettings>
  return {
    enabled: saved.enabled === true,
    token: typeof saved.token === 'string' ? saved.token : '',
    port:
      typeof saved.port === 'number' && Number.isInteger(saved.port) ? saved.port : DEFAULT_PORT,
    backgroundModeEnabled: saved.backgroundModeEnabled === true
  }
}

const settingsFile = createJsonSettingsFile<ExtensionBridgeSettings>(
  SETTINGS_FILE,
  parse,
  DEFAULT_SETTINGS
)

export function readExtensionBridgeSettings(): ExtensionBridgeSettings {
  return settingsFile.read()
}

export function writeExtensionBridgeSettings(settings: ExtensionBridgeSettings): void {
  settingsFile.write(settings)
}

/** Generates a token only if one has never been set - called when the bridge is first enabled. */
export function ensureExtensionBridgeToken(): ExtensionBridgeSettings {
  const current = readExtensionBridgeSettings()
  if (current.token) return current
  const next: ExtensionBridgeSettings = { ...current, token: generateToken() }
  writeExtensionBridgeSettings(next)
  return next
}

/** Always generates a fresh token, invalidating the previous one. */
export function regenerateExtensionBridgeToken(): ExtensionBridgeSettings {
  const next: ExtensionBridgeSettings = { ...readExtensionBridgeSettings(), token: generateToken() }
  writeExtensionBridgeSettings(next)
  return next
}

/** Test-only: clears the in-module cache so a fresh per-test userData dir isn't shadowed. */
export function resetExtensionBridgeSettingsCache(): void {
  settingsFile.invalidate()
}
