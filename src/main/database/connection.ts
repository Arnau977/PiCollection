import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import type { DB } from './schema'

let dbInstance: Kysely<DB> | null = null
let sqliteInstance: Database.Database | null = null

function buildDb(
  databasePath: string,
  options?: { verboseLogging?: boolean }
): { db: Kysely<DB>; sqlite: Database.Database } {
  const sqlite = new Database(databasePath)
  sqlite.pragma('foreign_keys = ON')

  const db = new Kysely<DB>({
    dialect: new SqliteDialect({ database: sqlite }),
    log: options?.verboseLogging ? ['query', 'error'] : ['error']
  })

  return { db, sqlite }
}

export function createDb(databasePath: string, options?: { verboseLogging?: boolean }): Kysely<DB> {
  return buildDb(databasePath, options).db
}

export function initDb(databasePath: string, options?: { verboseLogging?: boolean }): Kysely<DB> {
  const { db, sqlite } = buildDb(databasePath, options)
  dbInstance = db
  sqliteInstance = sqlite
  return db
}

/**
 * Releases the singleton connection's handle on the database file. Required
 * before the file itself is overwritten (backup restore) - on Windows an open
 * handle would block the write, and elsewhere the live connection would keep
 * serving stale pages from the replaced file. A no-op when nothing was ever
 * initialized.
 */
export async function closeDb(): Promise<void> {
  const db = dbInstance
  const sqlite = sqliteInstance
  dbInstance = null
  sqliteInstance = null

  if (db) await db.destroy()

  // Kysely's SqliteDriver only closes the underlying handle if its driver was
  // ever initialized, and that happens lazily on the first query - so a
  // connection that was opened but never queried would survive destroy() and
  // keep the file locked. Closing the raw handle directly is the guarantee.
  if (sqlite?.open) sqlite.close()
}

export function getDb(): Kysely<DB> {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Call initDb() first.')
  }
  return dbInstance
}
