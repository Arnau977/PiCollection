import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir }
}))

const { initTestDbSingleton } = await import('../database/testHelpers')
const { getDb } = await import('../database/connection')
const mediaRepo = await import('../database/repositories/media.repository')
const { readSourceFolder, writeSourceFolder } = await import('./sourceFolder')
const { sourceFolderMigrationService } = await import('./sourceFolderMigration.service')

let cleanup: () => Promise<void>

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'source-folder-migration-userdata-'))
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
  await fs.rm(userDataDir, { recursive: true, force: true })
})

async function insertRow(route: string): Promise<string> {
  const id = randomUUID()
  await mediaRepo.insertMediaRow(getDb(), {
    id,
    name: 'pic',
    sfw: 1,
    is_ai_generated: 0,
    type: 'image',
    route,
    alias: null,
    artist_id: null,
    created_at: Date.now(),
    hash: null,
    phash: null
  })
  return id
}

describe('sourceFolderMigrationService.scan', () => {
  it('counts a row that falls under the new folder as relocated and performs no writes', async () => {
    const newRoot = join(tmpdir(), 'sfm-new-root')
    await insertRow(join(newRoot, 'a.png'))

    const plan = await sourceFolderMigrationService.scan(newRoot)

    expect(plan).toEqual({ relocatedCount: 1, warnItems: [], warnedCount: 0 })
    const rows = await mediaRepo.listMediaRoutes(getDb())
    expect(rows[0].route).toBe(join(newRoot, 'a.png'))
    expect(readSourceFolder()).toBeNull()
  })

  it('reports a row outside the new folder as a warn item, staying absolute', async () => {
    const newRoot = join(tmpdir(), 'sfm-new-root-2')
    const outsideRoute = join(tmpdir(), 'sfm-outside', 'b.png')
    await insertRow(outsideRoute)

    const plan = await sourceFolderMigrationService.scan(newRoot)

    expect(plan.relocatedCount).toBe(0)
    expect(plan.warnedCount).toBe(1)
    expect(plan.warnItems).toEqual([
      {
        id: expect.any(String),
        name: 'pic',
        route: outsideRoute,
        plannedRoute: outsideRoute,
        wasRelative: false
      }
    ])
  })

  it('caps warnItems at 50 while warnedCount reflects the true total', async () => {
    const newRoot = join(tmpdir(), 'sfm-new-root-3')
    for (let i = 0; i < 55; i += 1) {
      await insertRow(join(tmpdir(), 'sfm-outside-many', `${i}.png`))
    }

    const plan = await sourceFolderMigrationService.scan(newRoot)

    expect(plan.warnedCount).toBe(55)
    expect(plan.warnItems).toHaveLength(50)
  })

  it('resolves an already-relative row against the OLD source folder before deciding against the new one', async () => {
    const oldRoot = join(tmpdir(), 'sfm-old-root')
    const newRoot = join(tmpdir(), 'sfm-new-root-4')
    writeSourceFolder(oldRoot)
    await insertRow(join('sub', 'a.png'))

    const plan = await sourceFolderMigrationService.scan(newRoot)

    expect(plan.relocatedCount).toBe(0)
    expect(plan.warnedCount).toBe(1)
    expect(plan.warnItems[0]).toEqual({
      id: expect.any(String),
      name: 'pic',
      route: join('sub', 'a.png'),
      plannedRoute: join(oldRoot, 'sub', 'a.png'),
      wasRelative: true
    })
  })

  it('treats newPath: null the same as any other target nothing currently fits under', async () => {
    const oldRoot = join(tmpdir(), 'sfm-old-root-2')
    writeSourceFolder(oldRoot)
    await insertRow(join('sub', 'a.png'))

    const plan = await sourceFolderMigrationService.scan(null)

    expect(plan.relocatedCount).toBe(0)
    expect(plan.warnedCount).toBe(1)
    expect(plan.warnItems[0].plannedRoute).toBe(join(oldRoot, 'sub', 'a.png'))
  })
})

describe('sourceFolderMigrationService.apply', () => {
  it('writes relativized routes and persists the new source folder only after the writes commit', async () => {
    const newRoot = join(tmpdir(), 'sfm-apply-root')
    const id = await insertRow(join(newRoot, 'sub', 'a.png'))

    const result = await sourceFolderMigrationService.apply(newRoot)

    expect(result).toEqual({ relocatedCount: 1, warnedCount: 0 })
    const rows = await mediaRepo.listMediaRoutes(getDb())
    expect(rows.find((r) => r.id === id)?.route).toBe(join('sub', 'a.png'))
    expect(readSourceFolder()).toBe(newRoot)
  })

  it('forces a row outside the new folder to absolute', async () => {
    const newRoot = join(tmpdir(), 'sfm-apply-root-2')
    const outsideRoute = join(tmpdir(), 'sfm-apply-outside', 'b.png')
    const id = await insertRow(outsideRoute)

    const result = await sourceFolderMigrationService.apply(newRoot)

    expect(result).toEqual({ relocatedCount: 0, warnedCount: 1 })
    const rows = await mediaRepo.listMediaRoutes(getDb())
    expect(rows.find((r) => r.id === id)?.route).toBe(outsideRoute)
  })

  it('clearing the source folder (null) converts every row back to absolute', async () => {
    const oldRoot = join(tmpdir(), 'sfm-apply-old-root')
    writeSourceFolder(oldRoot)
    const id = await insertRow(join('sub', 'a.png'))

    const result = await sourceFolderMigrationService.apply(null)

    expect(result).toEqual({ relocatedCount: 0, warnedCount: 1 })
    const rows = await mediaRepo.listMediaRoutes(getDb())
    expect(rows.find((r) => r.id === id)?.route).toBe(join(oldRoot, 'sub', 'a.png'))
    expect(readSourceFolder()).toBeNull()
  })

  it('is idempotent when re-applying the same target', async () => {
    const newRoot = join(tmpdir(), 'sfm-apply-idempotent')
    const id = await insertRow(join(newRoot, 'a.png'))

    await sourceFolderMigrationService.apply(newRoot)
    const secondResult = await sourceFolderMigrationService.apply(newRoot)

    expect(secondResult).toEqual({ relocatedCount: 1, warnedCount: 0 })
    const rows = await mediaRepo.listMediaRoutes(getDb())
    expect(rows.find((r) => r.id === id)?.route).toBe('a.png')
  })

  it('throws instead of reporting success when persisting the new source folder setting fails', async () => {
    const newRoot = join(tmpdir(), 'sfm-apply-write-fail')
    const id = await insertRow(join(newRoot, 'a.png'))

    // writeSourceFolder() swallows every filesystem error into a console
    // warning, so we can't observe a failed write via a thrown exception -
    // we have to actually make the write fail. Pointing app.getPath('userData')
    // at a directory that doesn't exist makes writeFileSync's parent
    // directory lookup fail (ENOENT), which is what a real "can't persist
    // the setting" scenario looks like.
    const writableUserDataDir = userDataDir
    userDataDir = join(writableUserDataDir, 'does-not-exist', 'nested')

    try {
      await expect(sourceFolderMigrationService.apply(newRoot)).rejects.toThrow(
        'Failed to persist the new source folder setting after migrating routes.'
      )
    } finally {
      userDataDir = writableUserDataDir
    }

    // The route rewrite still committed even though the setting write
    // failed - this is the "half-applied migration" state the thrown error
    // is meant to surface to the caller instead of hiding.
    const rows = await mediaRepo.listMediaRoutes(getDb())
    expect(rows.find((r) => r.id === id)?.route).toBe('a.png')
  })
})
