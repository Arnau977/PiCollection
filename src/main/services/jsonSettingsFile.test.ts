import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

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

const { createJsonSettingsFile } = await import('./jsonSettingsFile')

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'json-settings-file-'))
  vi.mocked(readFileSync).mockClear()
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
})

interface Shape {
  enabled: boolean
}

function makeFile(): ReturnType<typeof createJsonSettingsFile<Shape>> {
  return createJsonSettingsFile<Shape>(
    'test-settings.json',
    (raw) => ({ enabled: (raw as Partial<Shape>)?.enabled === true }),
    { enabled: false }
  )
}

describe('createJsonSettingsFile', () => {
  it('returns the default value when nothing is stored', () => {
    expect(makeFile().read()).toEqual({ enabled: false })
  })

  it('persists and reloads a written value', () => {
    const file = makeFile()
    file.write({ enabled: true })
    expect(file.read()).toEqual({ enabled: true })
  })

  it('returns the default value when the stored file is corrupted JSON', () => {
    writeFileSync(join(userDataDir, 'test-settings.json'), 'not-json', 'utf-8')
    expect(makeFile().read()).toEqual({ enabled: false })
  })

  it('only reads from disk once, then serves subsequent calls from an in-memory cache', () => {
    const file = makeFile()
    file.read()
    file.read()
    file.read()
    expect(vi.mocked(readFileSync).mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('updates the cache immediately on write, without requiring a re-read', () => {
    const file = makeFile()
    file.read() // establish cache
    file.write({ enabled: true })
    vi.mocked(readFileSync).mockClear()

    expect(file.read()).toEqual({ enabled: true })
    expect(readFileSync).not.toHaveBeenCalled()
  })

  it('re-reads from disk after invalidate()', () => {
    const file = makeFile()
    file.read()
    writeFileSync(
      join(userDataDir, 'test-settings.json'),
      JSON.stringify({ enabled: true }),
      'utf-8'
    )
    file.invalidate()

    expect(file.read()).toEqual({ enabled: true })
  })

  it('does not throw and logs a warning when the write fails', () => {
    const file = createJsonSettingsFile<Shape>(
      'nested/does-not-exist/test-settings.json',
      (raw) => ({ enabled: (raw as Partial<Shape>)?.enabled === true }),
      { enabled: false }
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => file.write({ enabled: true })).not.toThrow()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
