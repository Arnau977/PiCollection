import AdmZip from 'adm-zip'
import { app } from 'electron'
import { existsSync, promises as fs } from 'fs'
import { closeDb } from '../database/connection'
import { resolveElectronDbPath } from '../database/electronDbPath'
import { sauceNaoSettingsFilePath } from './sauceNao/sauceNaoSettings'
import { readUpdateChannel, updaterSettingsFilePath } from '../updater/updaterSettings'
import { sourceFolderSettingsFilePath } from './sourceFolder'
import { danbooruSettingsFilePath } from './danbooruSettings'

const DB_ENTRY = 'picollection.sqlite'
const SAUCE_NAO_ENTRY = 'sauce-nao-settings.json'
const UPDATER_ENTRY = 'updater-settings.json'
const SOURCE_FOLDER_ENTRY = 'source-folder-settings.json'
const DANBOORU_ENTRY = 'danbooru-settings.json'
const GALLERY_SETTINGS_ENTRY = 'gallery-settings.json'

export type BackupBuildKind = 'dev' | 'pre-release' | 'release'

/**
 * Classifies the running build for display in a backup's filename: an
 * unpackaged dev run, a packaged build on the beta update channel, or a
 * packaged build on the stable channel. There's no per-build flag baked in
 * at build time (see autoUpdater.ts) - the update channel the user has
 * opted into is the only "is this a pre-release install" signal available
 * at runtime.
 */
export function getBackupBuildKind(): BackupBuildKind {
  if (!app.isPackaged) return 'dev'
  return readUpdateChannel() === 'beta' ? 'pre-release' : 'release'
}

/**
 * Bundles everything PiCollection persists locally - the database, the
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

  const danbooruPath = danbooruSettingsFilePath()
  if (existsSync(danbooruPath)) zip.addLocalFile(danbooruPath, '', DANBOORU_ENTRY)

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

  const danbooruEntry = zip.getEntry(DANBOORU_ENTRY)
  if (danbooruEntry) {
    await fs.writeFile(danbooruSettingsFilePath(), zip.readFile(danbooruEntry) as Buffer)
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
