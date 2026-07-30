import { mkdirSync } from 'fs'
import path from 'path'
import { createDb } from '../src/main/database/connection'
import { createMigrator } from '../src/main/database/migrations/migrator'

const direction = process.argv[2]

if (direction !== 'up' && direction !== 'down') {
  console.error('Usage: npm run migrate:up | npm run migrate:down')
  process.exit(1)
}

const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), '.data', 'picollection.dev.sqlite')

async function main(): Promise<void> {
  mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = createDb(dbPath, { verboseLogging: true })
  const migrator = createMigrator(db)

  const result = direction === 'up' ? await migrator.migrateToLatest() : await migrator.migrateDown()

  for (const item of result.results ?? []) {
    if (item.status === 'Success') console.log(`Migration "${item.migrationName}" succeeded`)
    else if (item.status === 'Error') console.error(`Migration "${item.migrationName}" failed`)
  }

  await db.destroy()

  if (result.error) {
    console.error(result.error)
    process.exit(1)
  }
}

main()
