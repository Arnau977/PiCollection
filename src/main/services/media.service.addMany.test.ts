import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Same Electron/nativeImage stub rationale as media.service.duplicate.test.ts:
// real SHA-256 path, perceptual hashing faked out.
let userDataDir = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
  nativeImage: {
    createThumbnailFromPath: () => Promise.reject(new Error('unavailable in tests')),
    createFromPath: () => ({ isEmpty: () => true }),
    createFromBitmap: () => ({ isEmpty: () => true }),
    createFromBuffer: () => ({ isEmpty: () => true })
  }
}))

const { initTestDbSingleton } = await import('../database/testHelpers')
const { mediaService } = await import('./media.service')
const { resetSourceFolderCache } = await import('./sourceFolder')

let cleanup: () => Promise<void>
let sourceDir = ''

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'media-many-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'media-many-src-'))
  resetSourceFolderCache()
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

async function file(name: string, contents: string): Promise<string> {
  const p = join(sourceDir, name)
  await fs.writeFile(p, contents)
  return p
}

function input(route: string): Parameters<typeof mediaService.addMedia>[0] {
  return { name: 'x', type: 'image', route, sfw: true, isAiGenerated: false, pendingTagging: true }
}

describe('mediaService.addMediaMany', () => {
  it('creates every distinct file sequentially and reports the count', async () => {
    const inputs = [input(await file('a.png', 'a')), input(await file('b.png', 'b'))]

    const result = await mediaService.addMediaMany(inputs)

    expect(result).toEqual({ created: 2, skipped: 0, createdIds: expect.any(Array) })
    // Inputs go in as pending, so they only show up under a pending query now.
    const rows = await mediaService.getMediaFiltered({ pendingTagging: true })
    expect(rows.total).toBe(2)
  })

  it('skips a file already in the library instead of throwing', async () => {
    const a = await file('a.png', 'a')
    await mediaService.addMedia(input(a))

    const result = await mediaService.addMediaMany([input(a), input(await file('b.png', 'b'))])

    expect(result.created).toBe(1)
    expect(result.skipped).toBe(1)
    expect((await mediaService.getMediaFiltered({ pendingTagging: true })).total).toBe(2)
  })

  it('creates a repeated route within the same batch only once', async () => {
    const a = await file('a.png', 'a')

    const result = await mediaService.addMediaMany([input(a), input(a), input(a)])

    expect(result).toMatchObject({ created: 1, skipped: 2 })
    expect((await mediaService.getMediaFiltered({ pendingTagging: true })).total).toBe(1)
  })

  it('skips a same-content file imported under a different path within the batch', async () => {
    const a = await file('a.png', 'dup-bytes')
    const b = await file('b.png', 'dup-bytes')

    const result = await mediaService.addMediaMany([input(a), input(b)])

    expect(result).toMatchObject({ created: 1, skipped: 1 })
  })
})
