import AdmZip from 'adm-zip'
import { existsSync, promises as fs } from 'fs'
import { closeDb } from '../database/connection'
import { resolveElectronDbPath } from '../database/electronDbPath'
import { sauceNaoSettingsFilePath } from './sauceNaoSettings'
import { updaterSettingsFilePath } from '../updater/updaterSettings'
import { sourceFolderSettingsFilePath } from './sourceFolder'

const DB_ENTRY = 'picollection.sqlite'
const SAUCE_NAO_ENTRY = 'sauce-nao-settings.json'
const UPDATER_ENTRY = 'updater-settings.json'
const SOURCE_FOLDER_ENTRY = 'source-folder-settings.json'
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

  const sourceFolderPath = sourceFolderSettingsFilePath()
  if (existsSync(sourceFolderPath)) zip.addLocalFile(sourceFolderPath, '', SOURCE_FOLDER_ENTRY)

  zip.addFile(GALLERY_SETTINGS_ENTRY, Buffer.from(JSON.stringify(gallerySettings ?? {})))

  zip.writeZip(destPath)
}

/**
 * Replaces this install's database and settings files with the zip's
 * contents. The live DB connection is closed first, so nothing is holding a
 * handle on the file being overwritten. The caller is responsible for
 * restarting the app afterward - no connection is reopened here.
 */
export async function restoreBackupZip(
  sourcePath: string
): Promise<{ gallerySettings: unknown | null }> {
  const zip = new AdmZip(sourcePath)

  const dbEntry = zip.getEntry(DB_ENTRY)
  if (!dbEntry) {
    throw new Error("That file doesn't look like a PiCollection backup.")
  }

  // Closed only once the zip is known to be a real backup: bailing out above
  // leaves the running app with a working connection, while everything below
  // this line is destructive and must not run against an open handle.
  await closeDb()

  await fs.writeFile(resolveElectronDbPath(), zip.readFile(dbEntry) as Buffer)

  const sauceNaoEntry = zip.getEntry(SAUCE_NAO_ENTRY)
  if (sauceNaoEntry) {
    await fs.writeFile(sauceNaoSettingsFilePath(), zip.readFile(sauceNaoEntry) as Buffer)
  }

  const updaterEntry = zip.getEntry(UPDATER_ENTRY)
  if (updaterEntry) {
    await fs.writeFile(updaterSettingsFilePath(), zip.readFile(updaterEntry) as Buffer)
  }

  const sourceFolderEntry = zip.getEntry(SOURCE_FOLDER_ENTRY)
  if (sourceFolderEntry) {
    await fs.writeFile(sourceFolderSettingsFilePath(), zip.readFile(sourceFolderEntry) as Buffer)
  }

  // Everything above this point is destructive and has already succeeded, so a
  // corrupt gallery blob must not throw the whole call away - the caller would
  // report failure and skip the restart prompt the overwrite now requires.
  // An unreadable blob is treated exactly like an absent one.
  const galleryEntry = zip.getEntry(GALLERY_SETTINGS_ENTRY)
  let gallerySettings: unknown | null = null
  if (galleryEntry) {
    try {
      gallerySettings = JSON.parse(zip.readFile(galleryEntry)!.toString('utf-8')) as unknown
    } catch {
      gallerySettings = null
    }
  }

  return { gallerySettings }
}
