import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const name = process.argv[2]

if (!name) {
  console.error('Usage: npm run migrate:create <migration-name>')
  process.exit(1)
}

const migrationsDir = join(process.cwd(), 'src', 'main', 'database', 'migrations')
mkdirSync(migrationsDir, { recursive: true })

const slug = name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
const fileName = `${timestamp}_${slug}.ts`
const filePath = join(migrationsDir, fileName)

if (existsSync(filePath)) {
  console.error(`Migration file already exists: ${filePath}`)
  process.exit(1)
}

const template = `import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
}

export async function down(db: Kysely<any>): Promise<void> {
}
`

writeFileSync(filePath, template, 'utf-8')

console.log(`Created migration: src/main/database/migrations/${fileName}`)
console.log(
  `Remember to register it in src/main/database/migrations/index.ts as '${fileName.replace(/\.ts$/, '')}'`
)
