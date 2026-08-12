import { randomUUID } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { Kysely } from 'kysely'
import type { DB } from '../database/schema'

const createThumbnailFromPath = vi.fn()
const createFromPath = vi.fn()
const createFromBitmap = vi.fn()
const createFromBuffer = vi.fn()
let userDataDir = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
  nativeImage: {
    createThumbnailFromPath: (...args: unknown[]) => createThumbnailFromPath(...args),
    createFromPath: (...args: unknown[]) => createFromPath(...args),
    createFromBitmap: (...args: unknown[]) => createFromBitmap(...args),
    createFromBuffer: (...args: unknown[]) => createFromBuffer(...args)
  }
}))

const { initTestDbSingleton } = await import('../database/testHelpers')
const mediaRepo = await import('../database/repositories/media.repository')
const { writeSourceFolder, resetSourceFolderCache } = await import('./sourceFolder')
const { backfillMediaHashes } = await import('./mediaHashBackfill')

/** Fake NativeImage returned by the shell thumbnail provider - always succeeds. */
function fakeThumbnail(): unknown {
  return {
    isEmpty: () => false,
    getSize: () => ({ width: 480, height: 480 }),
    resize: () => fakeThumbnail(),
    toPNG: () => Buffer.from('fake-png-bytes')
  }
}

function emptyImage(): unknown {
  return { isEmpty: () => true }
}

let db: Kysely<DB>
let cleanup: () => Promise<void>
let sourceDir = ''

function insertRow(
  route: string,
  hash: string | null = null
): ReturnType<typeof mediaRepo.insertMediaRow> {
  return mediaRepo.insertMediaRow(db, {
    id: randomUUID(),
    name: 'pic',
    sfw: 1,
    is_ai_generated: 0,
    type: 'image',
    route,
    alias: null,
    artist_id: null,
    created_at: Date.now(),
    hash,
    phash: null,
    pending_tagging: 0
  })
}

beforeEach(async () => {
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'backfill-src-'))
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'backfill-cache-'))
  // readSourceFolder is module-scope cached; reset so each test starts from
  // its own fresh userData dir rather than an earlier test's cached value.
  resetSourceFolderCache()
  createThumbnailFromPath.mockReset().mockResolvedValue(fakeThumbnail())
  // Always empty -> computePerceptualHash short-circuits to null; the
  // dHash math itself is already covered by mediaHash.test.ts.
  createFromPath.mockReset().mockReturnValue(emptyImage())
  createFromBitmap.mockReset().mockReturnValue(emptyImage())
  createFromBuffer.mockReset().mockReturnValue(emptyImage())

  const testDb = await initTestDbSingleton()
  db = testDb.db
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('backfillMediaHashes', () => {
  it('computes and stores the hash for a row missing one', async () => {
    const file = join(sourceDir, 'a.png')
    await fs.writeFile(file, 'hello world')
    const row = await insertRow(file)

    await backfillMediaHashes()

    const updated = await mediaRepo.findMediaRowById(db, row.id)
    expect(updated?.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('marks a row whose file no longer exists with an empty-string sentinel instead of retrying it', async () => {
    const row = await insertRow(join(sourceDir, 'missing.png'))

    await backfillMediaHashes()

    const updated = await mediaRepo.findMediaRowById(db, row.id)
    expect(updated?.hash).toBe('')

    // A second run must not touch it again - listMediaRowsMissingHash only
    // selects `hash IS NULL`, so the sentinel makes this a no-op.
    createThumbnailFromPath.mockClear()
    await backfillMediaHashes()
    expect(createThumbnailFromPath).not.toHaveBeenCalled()
  })

  it('resolves a relative route against the configured source folder before hashing', async () => {
    // Without resolution this row would be unreadable and get the
    // empty-string sentinel, which permanently blacklists it from every
    // future sweep.
    await fs.mkdir(join(sourceDir, 'sub'), { recursive: true })
    await fs.writeFile(join(sourceDir, 'sub', 'c.png'), 'relative content')
    writeSourceFolder(sourceDir)
    const row = await insertRow(join('sub', 'c.png'))

    await backfillMediaHashes()

    const updated = await mediaRepo.findMediaRowById(db, row.id)
    expect(updated?.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('leaves rows that already have a hash untouched', async () => {
    const file = join(sourceDir, 'b.png')
    await fs.writeFile(file, 'already hashed')
    const row = await insertRow(file, 'precomputed')

    await backfillMediaHashes()

    const updated = await mediaRepo.findMediaRowById(db, row.id)
    expect(updated?.hash).toBe('precomputed')
  })
})
