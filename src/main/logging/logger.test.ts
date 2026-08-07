import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { promises as fsPromises } from 'fs'
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

const { logInfo, logWarn, logError, flushLogBuffer } = await import('./logger')
const { writeLoggingEnabled, resetLoggingEnabledCache } = await import('./loggingSettings')
const { currentLogFilePath } = await import('./rotation')

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'logger-'))
  resetLoggingEnabledCache()
  vi.mocked(readFileSync).mockClear()
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
})

describe('logger', () => {
  it('writes nothing when logging is disabled (the default)', () => {
    logInfo('test', 'hello')

    expect(existsSync(currentLogFilePath())).toBe(false)
  })

  it('writes an INFO line with meta when enabled', () => {
    writeLoggingEnabled(true)

    logInfo('test', 'hello', { foo: 'bar' })
    flushLogBuffer()

    const content = readFileSync(currentLogFilePath(), 'utf-8')
    expect(content).toContain('[INFO] [test] hello')
    expect(content).toContain('"foo":"bar"')
  })

  it('writes a WARN line when enabled', () => {
    writeLoggingEnabled(true)

    logWarn('test', 'careful')
    flushLogBuffer()

    const content = readFileSync(currentLogFilePath(), 'utf-8')
    expect(content).toContain('[WARN] [test] careful')
  })

  it('serializes an Error stack when logging an error', () => {
    writeLoggingEnabled(true)

    logError('test', 'boom', new Error('bad thing'))
    flushLogBuffer()

    const content = readFileSync(currentLogFilePath(), 'utf-8')
    expect(content).toContain('[ERROR] [test] boom')
    expect(content).toContain('bad thing')
  })

  it('logs a non-Error value passed to logError without throwing', () => {
    writeLoggingEnabled(true)

    expect(() => logError('test', 'boom', 'a plain string reason')).not.toThrow()
    flushLogBuffer()

    const content = readFileSync(currentLogFilePath(), 'utf-8')
    expect(content).toContain('a plain string reason')
  })

  it('does not hit the filesystem more than once when disabled, across many calls', () => {
    logInfo('test', 'one')
    logInfo('test', 'two')
    logWarn('test', 'three')
    logError('test', 'four')

    expect(vi.mocked(readFileSync).mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('buffers writes and flushes them together instead of writing on every call', () => {
    writeLoggingEnabled(true)
    logInfo('test', 'first message')
    logInfo('test', 'second message')

    expect(existsSync(currentLogFilePath())).toBe(false)

    flushLogBuffer()

    const content = readFileSync(currentLogFilePath(), 'utf-8')
    expect(content).toContain('first message')
    expect(content).toContain('second message')
  })
})
