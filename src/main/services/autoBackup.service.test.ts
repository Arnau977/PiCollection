import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import AdmZip from 'adm-zip'

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
    isPackaged: false
  }
}))
vi.mock('../events/autoBackupEvents', () => ({ notifyAutoBackupChanged: vi.fn() }))

const { initTestDbSingleton } = await import('../database/testHelpers')
const { resolveElectronDbPath } = await import('../database/electronDbPath')
const { isAutoBackupDue, runAutoBackup, updateAutoBackupConfig } = await import(
  './autoBackup.service'
)
const { DEFAULT_AUTO_BACKUP_SETTINGS, readAutoBackupSettings, resetAutoBackupSettingsCache } =
  await import('./autoBackupSettings')
const { resetUpdateChannelCache } = await import('../updater/updaterSettings')

const DAY_MS = 24 * 60 * 60 * 1000
let backupDir = ''
let cleanupDb: () => Promise<void>

async function listZips(): Promise<string[]> {
  return (await fs.readdir(backupDir)).sort()
}

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'auto-backup-test-'))
  backupDir = join(userDataDir, 'backups')
  resetAutoBackupSettingsCache()
  resetUpdateChannelCache()
  ;({ cleanup: cleanupDb } = await initTestDbSingleton())
  await updateAutoBackupConfig({ enabled: false })
})

afterEach(async () => {
  await cleanupDb()
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('isAutoBackupDue', () => {
  const now = Date.now()
  const enabled = { ...DEFAULT_AUTO_BACKUP_SETTINGS, enabled: true }

  it('is due only when enabled and the interval has elapsed since the last success', () => {
    expect(isAutoBackupDue(DEFAULT_AUTO_BACKUP_SETTINGS, now)).toBe(false)
    expect(isAutoBackupDue(enabled, now)).toBe(true)
    expect(isAutoBackupDue({ ...enabled, lastSuccessAt: now - DAY_MS + 1000 }, now)).toBe(false)
    expect(isAutoBackupDue({ ...enabled, lastSuccessAt: now - DAY_MS }, now)).toBe(true)
    expect(
      isAutoBackupDue({ ...enabled, frequency: 'weekly', lastSuccessAt: now - 2 * DAY_MS }, now)
    ).toBe(false)
  })
})

describe('runAutoBackup', () => {
  it('writes a restorable zip without the gallery blob and prunes only its own old backups', async () => {
    await fs.mkdir(backupDir, { recursive: true })
    const ownOld = ['01', '02', '03', '04', '05'].map(
      (day) => `picollection-auto-dev-2020-01-${day}T00-00-00-000Z.zip`
    )
    const untouchable = [
      'picollection-auto-release-2020-01-01T00-00-00-000Z.zip',
      'pre-migration-2020-01-01.zip',
      'my-notes.txt'
    ]
    for (const name of [...ownOld, ...untouchable]) await fs.writeFile(join(backupDir, name), '')
    await updateAutoBackupConfig({ keepCount: 5 })

    // Enabling kicks off the first (due) backup in the background.
    await updateAutoBackupConfig({ enabled: true })
    await vi.waitFor(() => expect(readAutoBackupSettings().lastSuccessAt).not.toBeNull())

    expect(readAutoBackupSettings().lastError).toBeNull()
    const files = await listZips()
    const own = files.filter((name) => name.startsWith('picollection-auto-dev-'))
    expect(own).toHaveLength(5)
    expect(own).not.toContain(ownOld[0])
    expect(files).toEqual(expect.arrayContaining(untouchable))

    const zip = new AdmZip(join(backupDir, own.at(-1)!))
    const entries = zip.getEntries().map((entry) => entry.entryName)
    expect(entries).toContain('picollection.sqlite')
    expect(entries).not.toContain('gallery-settings.json')
    expect(zip.readFile('picollection.sqlite')!.subarray(0, 15).toString()).toBe('SQLite format 3')
  })

  it('skips writing when nothing changed since the newest backup, unless forced', async () => {
    await fs.mkdir(backupDir, { recursive: true })
    await fs.writeFile(resolveElectronDbPath(), '')
    const past = new Date(Date.now() - DAY_MS)
    await fs.utimes(resolveElectronDbPath(), past, past)
    await fs.writeFile(join(backupDir, 'picollection-auto-dev-2020-01-01T00-00-00-000Z.zip'), '')
    await updateAutoBackupConfig({ enabled: true })
    await vi.waitFor(() => expect(readAutoBackupSettings().lastSuccessAt).not.toBeNull())

    expect(await listZips()).toHaveLength(1)

    await runAutoBackup({ force: true })
    expect(await listZips()).toHaveLength(2)
  })

  it('records the failure message and clears it on the next success', async () => {
    const blocker = join(userDataDir, 'not-a-folder')
    await fs.writeFile(blocker, '')
    await fs.writeFile(
      join(userDataDir, 'auto-backup-settings.json'),
      JSON.stringify({ ...DEFAULT_AUTO_BACKUP_SETTINGS, enabled: true, folder: blocker })
    )
    resetAutoBackupSettingsCache()

    const failed = await runAutoBackup({ force: true })
    expect(failed.lastError).toBeTruthy()
    expect(failed.lastSuccessAt).toBeNull()

    await fs.rm(blocker)
    const recovered = await runAutoBackup({ force: true })
    expect(recovered.lastError).toBeNull()
    expect(recovered.lastSuccessAt).not.toBeNull()
  })
})
