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

const { readUpdateChannel, writeUpdateChannel, resetUpdateChannelCache } = await import(
  './updaterSettings'
)

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'updater-settings-'))
  resetUpdateChannelCache()
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
})

describe('updaterSettings', () => {
  it('defaults to stable when nothing is stored', () => {
    expect(readUpdateChannel()).toBe('stable')
  })

  it('persists the channel across a restart (fresh cache, re-read from disk)', () => {
    writeUpdateChannel('beta')
    resetUpdateChannelCache()

    expect(readUpdateChannel()).toBe('beta')
  })

  it('defaults to stable when the stored file is corrupted JSON', () => {
    writeUpdateChannel('beta')
    resetUpdateChannelCache()

    writeFileSync(join(userDataDir, 'updater-settings.json'), 'not-json', 'utf-8')

    expect(readUpdateChannel()).toBe('stable')
  })
})
