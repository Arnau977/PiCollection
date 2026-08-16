import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import AdmZip from 'adm-zip'

let userDataDir = ''
let isPackaged = false

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
    get isPackaged() {
      return isPackaged
    }
  }
}))

const { createBackupZip, restoreBackupZip } = await import('./backupService')
const { resolveElectronDbPath } = await import('../database/electronDbPath')
const { sauceNaoSettingsFilePath } = await import('./sauceNao/sauceNaoSettings')
const { updaterSettingsFilePath } = await import('../updater/updaterSettings')
const { sourceFolderSettingsFilePath } = await import('./sourceFolder')

let workDir = ''
let zipPath = ''

beforeEach(async () => {
  workDir = await fs.mkdtemp(join(tmpdir(), 'backup-test-'))
  userDataDir = join(workDir, 'source-userdata')
  await fs.mkdir(userDataDir, { recursive: true })
  zipPath = join(workDir, 'backup.zip')
  isPackaged = false
})

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true })
})

describe('createBackupZip', () => {
  it('bundles the database, existing settings files, and the gallery settings blob', async () => {
    await fs.writeFile(resolveElectronDbPath(), 'fake sqlite bytes')
    await fs.writeFile(sauceNaoSettingsFilePath(), '{"apiKey":"secret"}')
    await fs.writeFile(updaterSettingsFilePath(), '{"channel":"beta"}')
    await fs.writeFile(sourceFolderSettingsFilePath(), '{"path":"D:\\\\Fotos"}')

    await createBackupZip(zipPath, { density: 'compact' })

    const zip = new AdmZip(zipPath)
    const entryNames = zip.getEntries().map((entry) => entry.entryName)
    expect(entryNames).toEqual(
      expect.arrayContaining([
        'picollection.sqlite',
        'sauce-nao-settings.json',
        'updater-settings.json',
        'source-folder-settings.json',
        'gallery-settings.json'
      ])
    )
    expect(zip.readAsText('picollection.sqlite')).toBe('fake sqlite bytes')
    expect(JSON.parse(zip.readAsText('gallery-settings.json'))).toEqual({ density: 'compact' })
  })

  it('omits settings files that were never created, without erroring', async () => {
    await fs.writeFile(resolveElectronDbPath(), 'fake sqlite bytes')

    await createBackupZip(zipPath, {})

    const zip = new AdmZip(zipPath)
    const entryNames = zip.getEntries().map((entry) => entry.entryName)
    expect(entryNames).toContain('picollection.sqlite')
    expect(entryNames).not.toContain('sauce-nao-settings.json')
    expect(entryNames).not.toContain('updater-settings.json')
    expect(entryNames).not.toContain('source-folder-settings.json')
  })
})

describe('restoreBackupZip', () => {
  it('writes the zip contents into the (possibly different) current userData dir', async () => {
    await fs.writeFile(resolveElectronDbPath(), 'original sqlite bytes')
    await fs.writeFile(sauceNaoSettingsFilePath(), '{"apiKey":"secret"}')
    await fs.writeFile(sourceFolderSettingsFilePath(), '{"path":"D:\\\\Fotos"}')
    await createBackupZip(zipPath, { density: 'large' })

    // Simulate restoring onto a different machine/install: a fresh, empty userData dir.
    userDataDir = join(workDir, 'destination-userdata')
    await fs.mkdir(userDataDir, { recursive: true })

    const result = await restoreBackupZip(zipPath)

    expect(await fs.readFile(resolveElectronDbPath(), 'utf-8')).toBe('original sqlite bytes')
    expect(await fs.readFile(sauceNaoSettingsFilePath(), 'utf-8')).toBe('{"apiKey":"secret"}')
    expect(await fs.readFile(sourceFolderSettingsFilePath(), 'utf-8')).toBe(
      '{"path":"D:\\\\Fotos"}'
    )
    expect(result.gallerySettings).toEqual({ density: 'large' })
  })

  it('returns null gallerySettings when the backup has none', async () => {
    await fs.writeFile(resolveElectronDbPath(), 'original sqlite bytes')
    const zip = new AdmZip()
    zip.addLocalFile(resolveElectronDbPath(), '', 'picollection.sqlite')
    zip.writeZip(zipPath)

    userDataDir = join(workDir, 'destination-userdata')
    await fs.mkdir(userDataDir, { recursive: true })

    const result = await restoreBackupZip(zipPath)
    expect(result.gallerySettings).toBeNull()
  })

  // The DB is overwritten before the gallery blob is read, so a parse failure
  // must not abort the call after the destructive part already happened - the
  // caller would report failure and never prompt for the required restart.
  it('still restores when the gallery settings entry is corrupt', async () => {
    await fs.writeFile(resolveElectronDbPath(), 'original sqlite bytes')
    const zip = new AdmZip()
    zip.addLocalFile(resolveElectronDbPath(), '', 'picollection.sqlite')
    zip.addFile('gallery-settings.json', Buffer.from('not json at all {{{'))
    zip.writeZip(zipPath)

    userDataDir = join(workDir, 'destination-userdata')
    await fs.mkdir(userDataDir, { recursive: true })

    const result = await restoreBackupZip(zipPath)

    expect(result.gallerySettings).toBeNull()
    expect(await fs.readFile(resolveElectronDbPath(), 'utf-8')).toBe('original sqlite bytes')
  })

  it('rejects a zip with no database entry', async () => {
    const zip = new AdmZip()
    zip.addFile('gallery-settings.json', Buffer.from('{}'))
    zip.writeZip(zipPath)

    await expect(restoreBackupZip(zipPath)).rejects.toThrow(
      "That file doesn't look like a PiCollection backup."
    )
  })
})
