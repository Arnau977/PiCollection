import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import type { DB } from './schema'

let dbInstance: Kysely<DB> | null = null

export function createDb(databasePath: string, options?: { verboseLogging?: boolean }): Kysely<DB> {
  const sqlite = new Database(databasePath)
  sqlite.pragma('foreign_keys = ON')

  return new Kysely<DB>({
    dialect: new SqliteDialect({ database: sqlite }),
    log: options?.verboseLogging ? ['query', 'error'] : ['error']
  })
}

export function initDb(databasePath: string, options?: { verboseLogging?: boolean }): Kysely<DB> {
  dbInstance = createDb(databasePath, options)
  return dbInstance
}

export function getDb(): Kysely<DB> {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Call initDb() first.')
  }
  return dbInstance
}
