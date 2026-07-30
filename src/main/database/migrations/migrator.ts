import { Migrator, type Kysely } from 'kysely'
import type { DB } from '../schema'
import { migrations } from './index'

export function createMigrator(db: Kysely<DB>): Migrator {
  return new Migrator({
    db,
    provider: { getMigrations: async () => migrations }
  })
}

export async function runMigrations(db: Kysely<DB>): Promise<void> {
  const migrator = createMigrator(db)
  const { error, results } = await migrator.migrateToLatest()

  for (const result of results ?? []) {
    if (result.status === 'Success') {
      console.info(`Migration "${result.migrationName}" executed successfully`)
    } else if (result.status === 'Error') {
      console.error(`Migration "${result.migrationName}" failed`)
    }
  }

  if (error) {
    throw error
  }
}
