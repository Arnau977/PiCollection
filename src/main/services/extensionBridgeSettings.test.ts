import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir }
}))

const {
  readExtensionBridgeSettings,
  writeExtensionBridgeSettings,
  ensureExtensionBridgeToken,
  regenerateExtensionBridgeToken,
  resetExtensionBridgeSettingsCache
} = await import('./extensionBridgeSettings')

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'ext-bridge-settings-'))
  resetExtensionBridgeSettingsCache()
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
})

describe('extensionBridgeSettings', () => {
  it('defaults to disabled, no token, default port', () => {
    const settings = readExtensionBridgeSettings()
    expect(settings).toEqual({ enabled: false, token: '', port: 8934, backgroundModeEnabled: false })
  })

  it('persists and reloads written settings', () => {
    writeExtensionBridgeSettings({
      enabled: true,
      token: 'abc',
      port: 9000,
      backgroundModeEnabled: true
    })
    expect(readExtensionBridgeSettings()).toEqual({
      enabled: true,
      token: 'abc',
      port: 9000,
      backgroundModeEnabled: true
    })
  })

  it('generates and persists a token only the first time it is ensured', () => {
    const first = ensureExtensionBridgeToken()
    expect(first.token).toHaveLength(64)

    const second = ensureExtensionBridgeToken()
    expect(second.token).toBe(first.token)
  })

  it('regenerateExtensionBridgeToken always produces a new token', () => {
    const first = ensureExtensionBridgeToken()
    const second = regenerateExtensionBridgeToken()
    expect(second.token).not.toBe(first.token)
    expect(second.token).toHaveLength(64)
  })

  it('falls back to defaults when the stored file is corrupted', () => {
    writeFileSync(join(userDataDir, 'extension-bridge-settings.json'), 'not-json', 'utf-8')
    expect(readExtensionBridgeSettings()).toEqual({
      enabled: false,
      token: '',
      port: 8934,
      backgroundModeEnabled: false
    })
  })
})
