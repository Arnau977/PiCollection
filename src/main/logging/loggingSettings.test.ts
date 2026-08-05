import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir
  }
}))

const { readLoggingEnabled, writeLoggingEnabled } = await import('./loggingSettings')

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'logging-settings-'))
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
})

describe('loggingSettings', () => {
  it('defaults to disabled when nothing is stored', () => {
    expect(readLoggingEnabled()).toBe(false)
  })

  it('persists and reloads an enabled setting', () => {
    writeLoggingEnabled(true)
    expect(readLoggingEnabled()).toBe(true)
  })

  it('persists and reloads a disabled setting', () => {
    writeLoggingEnabled(true)
    writeLoggingEnabled(false)
    expect(readLoggingEnabled()).toBe(false)
  })

  it('returns disabled when the stored file is corrupted JSON', () => {
    writeFileSync(join(userDataDir, 'logging-settings.json'), 'not-json', 'utf-8')
    expect(readLoggingEnabled()).toBe(false)
  })
})
