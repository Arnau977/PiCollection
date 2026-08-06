import { promises as fs } from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import type { Kysely } from 'kysely'
import type { DB } from '../schema'
import { createMigrator } from './migrator'

const DB_ZIP_ENTRY = 'picollection.sqlite'
const SNAPSHOT_PREFIX = 'pre-migration-'
const SNAPSHOTS_TO_KEEP = 5

/** True if any registered migration hasn't run against this database yet. */
export async function hasPendingMigrations(db: Kysely<DB>): Promise<boolean> {
  const migrations = await createMigrator(db).getMigrations()
  return migrations.some((migration) => migration.executedAt === undefined)
}

/**
 * Zips the database file (alone, same entry name `createBackupZip` uses) into
 * `backupsDir` under a timestamped name, so it's restorable through the
 * existing "Import backup" flow with no new restore code.
 */
export async function snapshotDatabase(databasePath: string, backupsDir: string): Promise<string> {
  await fs.mkdir(backupsDir, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const snapshotPath = path.join(backupsDir, `${SNAPSHOT_PREFIX}${timestamp}.zip`)

  const zip = new AdmZip()
  zip.addLocalFile(databasePath, '', DB_ZIP_ENTRY)
  zip.writeZip(snapshotPath)

  return snapshotPath
}

/** Keeps only the SNAPSHOTS_TO_KEEP most recent pre-migration snapshots; a no-op if the directory is missing. */
export async function pruneSnapshots(backupsDir: string): Promise<void> {
  let entries: string[]
  try {
    entries = await fs.readdir(backupsDir)
  } catch {
    return
  }

  // ISO-with-dashes timestamps in the filename sort lexically in chronological order.
  const snapshots = entries
    .filter((name) => name.startsWith(SNAPSHOT_PREFIX) && name.endsWith('.zip'))
    .sort()

  const toDelete = snapshots.slice(0, Math.max(0, snapshots.length - SNAPSHOTS_TO_KEEP))
  await Promise.all(toDelete.map((name) => fs.unlink(path.join(backupsDir, name))))
}
