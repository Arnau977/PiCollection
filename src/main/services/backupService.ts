import AdmZip from 'adm-zip'
import { existsSync, promises as fs } from 'fs'
import { resolveElectronDbPath } from '../database/electronDbPath'
import { sauceNaoSettingsFilePath } from './sauceNaoSettings'
import { updaterSettingsFilePath } from '../updater/updaterSettings'

const DB_ENTRY = 'picollection.sqlite'
const SAUCE_NAO_ENTRY = 'sauce-nao-settings.json'
const UPDATER_ENTRY = 'updater-settings.json'
const GALLERY_SETTINGS_ENTRY = 'gallery-settings.json'

/**
 * Bundles everything PiCollection persists locally - the database, the two
 * small settings files (when they exist), and the renderer-supplied gallery
 * preferences blob (localStorage-backed, so it can't be read from here) -
 * into a single zip at `destPath`.
 */
export async function createBackupZip(destPath: string, gallerySettings: unknown): Promise<void> {
  const zip = new AdmZip()
  zip.addLocalFile(resolveElectronDbPath(), '', DB_ENTRY)

  const sauceNaoPath = sauceNaoSettingsFilePath()
  if (existsSync(sauceNaoPath)) zip.addLocalFile(sauceNaoPath, '', SAUCE_NAO_ENTRY)

  const updaterPath = updaterSettingsFilePath()
  if (existsSync(updaterPath)) zip.addLocalFile(updaterPath, '', UPDATER_ENTRY)

  zip.addFile(GALLERY_SETTINGS_ENTRY, Buffer.from(JSON.stringify(gallerySettings ?? {})))

  zip.writeZip(destPath)
}

/**
 * Replaces this install's database and settings files with the zip's
 * contents. The caller is responsible for restarting the app afterward -
 * the live DB connection must not keep using the file this just overwrote.
 */
export async function restoreBackupZip(
  sourcePath: string
): Promise<{ gallerySettings: unknown | null }> {
  const zip = new AdmZip(sourcePath)

  const dbEntry = zip.getEntry(DB_ENTRY)
  if (!dbEntry) {
    throw new Error("That file doesn't look like a PiCollection backup.")
  }
  await fs.writeFile(resolveElectronDbPath(), zip.readFile(dbEntry) as Buffer)

  const sauceNaoEntry = zip.getEntry(SAUCE_NAO_ENTRY)
  if (sauceNaoEntry) {
    await fs.writeFile(sauceNaoSettingsFilePath(), zip.readFile(sauceNaoEntry) as Buffer)
  }

  const updaterEntry = zip.getEntry(UPDATER_ENTRY)
  if (updaterEntry) {
    await fs.writeFile(updaterSettingsFilePath(), zip.readFile(updaterEntry) as Buffer)
  }

  const galleryEntry = zip.getEntry(GALLERY_SETTINGS_ENTRY)
  const gallerySettings = galleryEntry
    ? (JSON.parse(zip.readFile(galleryEntry)!.toString('utf-8')) as unknown)
    : null

  return { gallerySettings }
}
