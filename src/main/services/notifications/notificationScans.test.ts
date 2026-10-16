import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({ app: { getPath: () => userDataDir, isPackaged: false } }))

const { initTestDbSingleton } = await import('../../database/testHelpers')
const { runScans, getScanResults, __resetScansForTests } = await import('./notificationScans')
const { writeSourceFolder, resetSourceFolderCache } = await import('../sourceFolder')

let cleanupDb: () => Promise<void>

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'notification-scans-test-'))
  resetSourceFolderCache()
  __resetScansForTests()
  ;({ cleanup: cleanupDb } = await initTestDbSingleton())
})

afterEach(async () => {
  await cleanupDb()
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('notification scans', () => {
  it('leaves both counts unknown while the DB is closed', async () => {
    await cleanupDb() // closes the DB, as a restore does
    await runScans()
    expect(getScanResults()).toEqual({
      missingCount: null,
      newFilesCount: null,
      sourceFolderScannedAt: null
    })
    ;({ cleanup: cleanupDb } = await initTestDbSingleton())
  })

  it('counts new files in the source folder, and treats an unreachable folder as unknown', async () => {
    const folder = join(userDataDir, 'source')
    await fs.mkdir(folder)
    await fs.writeFile(join(folder, 'a.png'), '')
    await fs.writeFile(join(folder, 'notes.txt'), '')
    writeSourceFolder(folder)
    await runScans({ sourceFolder: true })
    expect(getScanResults().newFilesCount).toBe(1)

    writeSourceFolder(join(folder, 'gone'))
    await runScans({ sourceFolder: true })
    expect(getScanResults().newFilesCount).toBeNull()
  })

  it('reports no missing files for an empty library', async () => {
    await runScans({ missing: true })
    expect(getScanResults().missingCount).toBe(0)
  })

  it('never runs two scans at once', async () => {
    const first = runScans()
    expect(runScans()).toBe(first)
    await first
  })
})
