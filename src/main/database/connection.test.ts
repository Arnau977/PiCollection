import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { closeDb, getDb, initDb } from './connection'

let dir = ''

afterEach(async () => {
  const created = dir
  dir = ''
  await closeDb()
  if (created) rmSync(created, { recursive: true, force: true })
})

function tempDbPath(): string {
  dir = mkdtempSync(path.join(tmpdir(), 'connection-test-'))
  return path.join(dir, 'test.sqlite')
}

describe('closeDb', () => {
  it('releases the singleton so it can no longer be used', async () => {
    initDb(tempDbPath())
    expect(getDb()).toBeDefined()

    await closeDb()

    expect(() => getDb()).toThrow('Database has not been initialized')
  })

  // The whole point of closing: restoreBackupZip overwrites this file next,
  // and on Windows a surviving handle makes that fail. Kysely's destroy() is
  // a no-op until its driver has lazily initialized on a first query, so the
  // never-queried case is the one that used to leave the file locked.
  it('releases the file handle even if no query was ever run', async () => {
    const dbPath = tempDbPath()
    initDb(dbPath)

    await closeDb()

    expect(() => rmSync(dbPath, { force: true })).not.toThrow()
  })

  // restoreBackupZip calls this on installs where the DB was never opened.
  it('is a no-op when nothing was ever initialized', async () => {
    await expect(closeDb()).resolves.toBeUndefined()
    await expect(closeDb()).resolves.toBeUndefined()
  })

  it('can be called twice after an init without throwing', async () => {
    initDb(tempDbPath())

    await closeDb()

    await expect(closeDb()).resolves.toBeUndefined()
  })
})
