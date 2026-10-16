import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''
const logError = vi.fn()

vi.mock('electron', () => ({ app: { getPath: () => userDataDir, isPackaged: false } }))
vi.mock('../../logging/logger', () => ({ logError, logInfo: vi.fn() }))

const { initTestDbSingleton } = await import('../../database/testHelpers')
const { writeSourceFolder, resetSourceFolderCache } = await import('../sourceFolder')
const {
  expandPaths,
  startSourceFolderWatcher,
  stopSourceFolderWatcher,
  ensureSourceFolderWatcher,
  isSourceFolderWatcherRunning,
  __emitWatcherErrorForTests
} = await import('./sourceFolderWatcher')

let cleanup: () => Promise<void>
let sourceDir = ''

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'watcher-run-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'watcher-run-source-'))
  resetSourceFolderCache()
  logError.mockReset()
  cleanup = (await initTestDbSingleton()).cleanup
  writeSourceFolder(sourceDir)
})

afterEach(async () => {
  stopSourceFolderWatcher()
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('source-folder watcher', () => {
  it('expands a renamed folder into the files inside it', async () => {
    await fs.mkdir(join(sourceDir, 'renamed', 'nested'), { recursive: true })
    await fs.writeFile(join(sourceDir, 'renamed', 'a.png'), 'a')
    await fs.writeFile(join(sourceDir, 'renamed', 'nested', 'b.png'), 'b')
    await fs.writeFile(join(sourceDir, 'c.png'), 'c')

    const files = await expandPaths([join(sourceDir, 'renamed'), join(sourceDir, 'c.png')])

    expect(files.sort()).toEqual(
      [
        join(sourceDir, 'renamed', 'a.png'),
        join(sourceDir, 'renamed', 'nested', 'b.png'),
        join(sourceDir, 'c.png')
      ].sort()
    )
  })

  it('survives the watched folder disappearing, and starts again when asked', () => {
    startSourceFolderWatcher()
    expect(isSourceFolderWatcherRunning()).toBe(true)

    expect(() => __emitWatcherErrorForTests(new Error('EPERM: folder removed'))).not.toThrow()
    expect(logError).toHaveBeenCalled()
    expect(isSourceFolderWatcherRunning()).toBe(false)

    ensureSourceFolderWatcher()
    expect(isSourceFolderWatcherRunning()).toBe(true)
  })

  it('does not start without a source folder', () => {
    writeSourceFolder(null)
    startSourceFolderWatcher()
    expect(isSourceFolderWatcherRunning()).toBe(false)
  })
})
