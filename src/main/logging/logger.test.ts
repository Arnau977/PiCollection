import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { promises as fsPromises } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir
  }
}))

const { logInfo, logWarn, logError } = await import('./logger')
const { writeLoggingEnabled } = await import('./loggingSettings')
const { currentLogFilePath } = await import('./rotation')

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'logger-'))
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

    const content = readFileSync(currentLogFilePath(), 'utf-8')
    expect(content).toContain('[INFO] [test] hello')
    expect(content).toContain('"foo":"bar"')
  })

  it('writes a WARN line when enabled', () => {
    writeLoggingEnabled(true)

    logWarn('test', 'careful')

    const content = readFileSync(currentLogFilePath(), 'utf-8')
    expect(content).toContain('[WARN] [test] careful')
  })

  it('serializes an Error stack when logging an error', () => {
    writeLoggingEnabled(true)

    logError('test', 'boom', new Error('bad thing'))

    const content = readFileSync(currentLogFilePath(), 'utf-8')
    expect(content).toContain('[ERROR] [test] boom')
    expect(content).toContain('bad thing')
  })

  it('logs a non-Error value passed to logError without throwing', () => {
    writeLoggingEnabled(true)

    expect(() => logError('test', 'boom', 'a plain string reason')).not.toThrow()

    const content = readFileSync(currentLogFilePath(), 'utf-8')
    expect(content).toContain('a plain string reason')
  })
})
