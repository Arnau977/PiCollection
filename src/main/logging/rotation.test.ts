import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { promises as fsPromises } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir
  }
}))

const { MAX_LOG_FILE_BYTES, currentLogFilePath, logsDir, rotateIfNeeded } = await import(
  './rotation'
)

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'logging-rotation-'))
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
})

function writeLogOfSize(path: string, bytes: number): void {
  writeFileSync(path, 'x'.repeat(bytes), 'utf-8')
}

describe('rotateIfNeeded', () => {
  it('creates the logs directory if missing and does nothing when there is no current log file', () => {
    rotateIfNeeded()

    expect(existsSync(logsDir())).toBe(true)
    expect(existsSync(currentLogFilePath())).toBe(false)
  })

  it('does not rotate when the current log file is under the size limit', () => {
    mkdirSync(logsDir(), { recursive: true })
    writeLogOfSize(currentLogFilePath(), 100)

    rotateIfNeeded()

    expect(existsSync(currentLogFilePath())).toBe(true)
    expect(existsSync(join(logsDir(), 'app.1.log'))).toBe(false)
  })

  it('rotates app.log to app.1.log when the size limit is reached', () => {
    mkdirSync(logsDir(), { recursive: true })
    writeLogOfSize(currentLogFilePath(), MAX_LOG_FILE_BYTES)

    rotateIfNeeded()

    expect(existsSync(currentLogFilePath())).toBe(false)
    expect(existsSync(join(logsDir(), 'app.1.log'))).toBe(true)
  })

  it('shifts existing rotated files up and drops the oldest beyond the retention limit', () => {
    mkdirSync(logsDir(), { recursive: true })
    writeFileSync(join(logsDir(), 'app.1.log'), 'one', 'utf-8')
    writeFileSync(join(logsDir(), 'app.2.log'), 'two', 'utf-8')
    writeFileSync(join(logsDir(), 'app.3.log'), 'three', 'utf-8')
    writeFileSync(join(logsDir(), 'app.4.log'), 'four', 'utf-8')
    writeLogOfSize(currentLogFilePath(), MAX_LOG_FILE_BYTES)

    rotateIfNeeded()

    expect(readFileSync(join(logsDir(), 'app.1.log'), 'utf-8')).toHaveLength(MAX_LOG_FILE_BYTES)
    expect(readFileSync(join(logsDir(), 'app.2.log'), 'utf-8')).toBe('one')
    expect(readFileSync(join(logsDir(), 'app.3.log'), 'utf-8')).toBe('two')
    expect(readFileSync(join(logsDir(), 'app.4.log'), 'utf-8')).toBe('three')
    // The old app.4.log ('four') is dropped - only 5 files (current + 4
    // rotated) are ever retained.
  })
})
