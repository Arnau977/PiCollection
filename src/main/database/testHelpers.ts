import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import type { Kysely } from 'kysely'
import { createDb, initDb } from './connection'
import { runMigrations } from './migrations/migrator'
import type { DB } from './schema'

function makeTempDbPath(): { dir: string; dbPath: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'picollection-test-'))
  return { dir, dbPath: path.join(dir, `${randomUUID()}.sqlite`) }
}

export async function createTestDb(): Promise<{ db: Kysely<DB>; cleanup: () => Promise<void> }> {
  const { dir, dbPath } = makeTempDbPath()
  const db = createDb(dbPath)
  await runMigrations(db)
  return {
    db,
    cleanup: async (): Promise<void> => {
      await db.destroy()
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

/** Initializes the module-level DB singleton used by services via getDb(). */
export async function initTestDbSingleton(): Promise<{
  db: Kysely<DB>
  cleanup: () => Promise<void>
}> {
  const { dir, dbPath } = makeTempDbPath()
  const db = initDb(dbPath)
  await runMigrations(db)
  return {
    db,
    cleanup: async (): Promise<void> => {
      await db.destroy()
      rmSync(dir, { recursive: true, force: true })
    }
  }
}
