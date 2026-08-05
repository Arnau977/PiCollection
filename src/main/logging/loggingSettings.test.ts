import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// vi.spyOn can't redefine a built-in ESM module's exports directly, so the
// module itself is mocked with a vi.fn() wrapper around the real
// implementation - this lets tests observe call counts while everything
// still hits the real filesystem underneath.
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync)
  }
})

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir
  }
}))

const { readLoggingEnabled, writeLoggingEnabled, resetLoggingEnabledCache } = await import(
  './loggingSettings'
)

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'logging-settings-'))
  resetLoggingEnabledCache()
  vi.mocked(readFileSync).mockClear()
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

  it('only reads from disk once, then serves subsequent calls from an in-memory cache', () => {
    readLoggingEnabled()
    readLoggingEnabled()
    readLoggingEnabled()

    expect(vi.mocked(readFileSync).mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('updates the cache immediately on write, without requiring a re-read', () => {
    readLoggingEnabled() // establish cache as disabled
    writeLoggingEnabled(true)
    vi.mocked(readFileSync).mockClear()

    expect(readLoggingEnabled()).toBe(true)
    expect(readFileSync).not.toHaveBeenCalled()
  })
})
