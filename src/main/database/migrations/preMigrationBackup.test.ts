import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import AdmZip from 'adm-zip'
import { createDb } from '../connection'
import { runMigrations } from './migrator'
import { hasPendingMigrations, pruneSnapshots, snapshotDatabase } from './preMigrationBackup'

let workDir = ''

beforeEach(async () => {
  workDir = await fs.mkdtemp(join(tmpdir(), 'pre-migration-backup-test-'))
})

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true })
})

describe('hasPendingMigrations', () => {
  it('is true for a freshly created database with no migrations run yet', async () => {
    const db = createDb(join(workDir, 'fresh.sqlite'))
    try {
      expect(await hasPendingMigrations(db)).toBe(true)
    } finally {
      await db.destroy()
    }
  })

  it('is false once every migration has been applied', async () => {
    const db = createDb(join(workDir, 'migrated.sqlite'))
    try {
      await runMigrations(db)
      expect(await hasPendingMigrations(db)).toBe(false)
    } finally {
      await db.destroy()
    }
  })
})

describe('snapshotDatabase', () => {
  it('writes a zip containing the database under the picollection.sqlite entry', async () => {
    const dbPath = join(workDir, 'picollection.sqlite')
    await fs.writeFile(dbPath, 'fake sqlite bytes')
    const backupsDir = join(workDir, 'backups')

    const snapshotPath = await snapshotDatabase(dbPath, backupsDir)

    expect(snapshotPath.startsWith(backupsDir)).toBe(true)
    const zip = new AdmZip(snapshotPath)
    expect(zip.readAsText('picollection.sqlite')).toBe('fake sqlite bytes')
  })

  it('creates the backups directory if it does not exist yet', async () => {
    const dbPath = join(workDir, 'picollection.sqlite')
    await fs.writeFile(dbPath, 'fake sqlite bytes')
    const backupsDir = join(workDir, 'nested', 'backups')

    await snapshotDatabase(dbPath, backupsDir)

    expect((await fs.stat(backupsDir)).isDirectory()).toBe(true)
  })
})

describe('pruneSnapshots', () => {
  it('keeps only the 5 most recent pre-migration-*.zip files', async () => {
    const backupsDir = join(workDir, 'backups')
    await fs.mkdir(backupsDir, { recursive: true })
    const names = [
      'pre-migration-2026-01-01T00-00-00-000Z.zip',
      'pre-migration-2026-01-02T00-00-00-000Z.zip',
      'pre-migration-2026-01-03T00-00-00-000Z.zip',
      'pre-migration-2026-01-04T00-00-00-000Z.zip',
      'pre-migration-2026-01-05T00-00-00-000Z.zip',
      'pre-migration-2026-01-06T00-00-00-000Z.zip'
    ]
    for (const name of names) {
      await fs.writeFile(join(backupsDir, name), 'zip bytes')
    }

    await pruneSnapshots(backupsDir)

    const remaining = (await fs.readdir(backupsDir)).sort()
    expect(remaining).toEqual(names.slice(1))
  })

  it('ignores files that are not pre-migration snapshots', async () => {
    const backupsDir = join(workDir, 'backups')
    await fs.mkdir(backupsDir, { recursive: true })
    await fs.writeFile(join(backupsDir, 'picollection-backup-2026-01-01.zip'), 'manual backup')

    await pruneSnapshots(backupsDir)

    expect(await fs.readdir(backupsDir)).toEqual(['picollection-backup-2026-01-01.zip'])
  })

  it('does nothing when the backups directory does not exist yet', async () => {
    await expect(pruneSnapshots(join(workDir, 'never-created'))).resolves.toBeUndefined()
  })
})
