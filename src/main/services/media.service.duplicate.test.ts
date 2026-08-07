import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// mediaService.addMedia/checkDuplicate now hash the candidate file, which for
// a real (non-mocked) file also tries to generate a perceptual hash off its
// thumbnail - that goes through Electron's nativeImage, unavailable outside
// a real Electron process, so it's stubbed the same way thumbnails.test.ts
// does. Every hash computation here still uses the real SHA-256 path (plain
// Node crypto/fs), only the perceptual side is faked out.
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
const { writeSourceFolder, resetSourceFolderCache } = await import('./sourceFolder')

let cleanup: () => Promise<void>
let sourceDir = ''

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'media-dup-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'media-dup-src-'))
  // readSourceFolder is module-scope cached; reset so each test starts from
  // its own fresh userData dir rather than an earlier test's cached value.
  resetSourceFolderCache()
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

function baseInput(
  route: string,
  overrides: Record<string, unknown> = {}
): Parameters<typeof mediaService.addMedia>[0] {
  return {
    name: 'My media',
    type: 'image',
    route,
    sfw: true,
    isAiGenerated: false,
    ...overrides
  } as Parameters<typeof mediaService.addMedia>[0]
}

describe('mediaService.checkDuplicate', () => {
  it('reports an exact match by route even before any hash is involved', async () => {
    const file = join(sourceDir, 'a.png')
    await fs.writeFile(file, 'hello world')
    const created = await mediaService.addMedia(baseInput(file))

    const result = await mediaService.checkDuplicate(file)

    expect(result.exactMatch?.id).toBe(created.id)
    expect(result.similar).toEqual([])
  })

  it('reports an exact match by content hash when the route differs', async () => {
    const fileA = join(sourceDir, 'a.png')
    const fileB = join(sourceDir, 'b.png')
    await fs.writeFile(fileA, 'identical bytes')
    await fs.writeFile(fileB, 'identical bytes')
    const created = await mediaService.addMedia(baseInput(fileA))

    const result = await mediaService.checkDuplicate(fileB)

    expect(result.exactMatch?.id).toBe(created.id)
  })

  it('reports no match for genuinely new content', async () => {
    const file = join(sourceDir, 'new.png')
    await fs.writeFile(file, 'brand new content')

    const result = await mediaService.checkDuplicate(file)

    expect(result.exactMatch).toBeNull()
    expect(result.similar).toEqual([])
  })
})

describe('mediaService.addMedia duplicate rejection', () => {
  it('rejects adding the same path twice', async () => {
    const file = join(sourceDir, 'a.png')
    await fs.writeFile(file, 'hello world')
    await mediaService.addMedia(baseInput(file))

    await expect(mediaService.addMedia(baseInput(file))).rejects.toThrow(/already in the library/)
  })

  it('rejects adding identical content from a different path', async () => {
    const fileA = join(sourceDir, 'a.png')
    const fileB = join(sourceDir, 'b.png')
    await fs.writeFile(fileA, 'identical bytes')
    await fs.writeFile(fileB, 'identical bytes')
    await mediaService.addMedia(baseInput(fileA))

    await expect(mediaService.addMedia(baseInput(fileB))).rejects.toThrow(/already in the library/)
  })

  it('stores a SHA-256 hash on the created row for future duplicate checks', async () => {
    const file = join(sourceDir, 'a.png')
    await fs.writeFile(file, 'hello world')

    const created = await mediaService.addMedia(baseInput(file))
    const duplicate = await mediaService.checkDuplicate(file)

    expect(duplicate.exactMatch?.id).toBe(created.id)
  })
})

describe('mediaService source folder awareness', () => {
  it('stores a relative route for a file under the configured source folder, absolute otherwise', async () => {
    writeSourceFolder(sourceDir)
    await fs.mkdir(join(sourceDir, 'sub'), { recursive: true })
    const file = join(sourceDir, 'sub', 'a.png')
    await fs.writeFile(file, 'hello')

    const created = await mediaService.addMedia(baseInput(file))

    expect(created.route).toBe(join('sub', 'a.png'))

    const outsideDir = await fs.mkdtemp(join(tmpdir(), 'media-dup-outside-'))
    try {
      const outsideFile = join(outsideDir, 'b.png')
      await fs.writeFile(outsideFile, 'world')

      const createdOutside = await mediaService.addMedia(baseInput(outsideFile))

      expect(createdOutside.route).toBe(outsideFile)
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true })
    }
  })

  it('finds a relative-stored row as an exact duplicate when checked with the equivalent absolute path', async () => {
    writeSourceFolder(sourceDir)
    const file = join(sourceDir, 'a.png')
    await fs.writeFile(file, 'hello world')
    const created = await mediaService.addMedia(baseInput(file))
    expect(created.route).toBe('a.png')

    const result = await mediaService.checkDuplicate(file)

    expect(result.exactMatch?.id).toBe(created.id)
  })
})
