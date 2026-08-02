import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join, sep } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

// mediaService.addMedia hashes the candidate file, which for a real
// (non-mocked) file also tries to generate a perceptual hash off its
// thumbnail - that goes through Electron's nativeImage, unavailable outside
// a real Electron process, so it's stubbed the same way
// media.service.duplicate.test.ts does. app.getPath now needs a real,
// writable directory too, since these tests also read/write the source
// folder setting.
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
const { mediaMaintenanceService } = await import('./mediaMaintenance.service')
const { writeSourceFolder } = await import('./sourceFolder')

let cleanup: () => Promise<void>
let sourceDir = ''

beforeEach(async () => {
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'maintenance-test-'))
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'maintenance-userdata-'))
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

function baseInput(route: string): Parameters<typeof mediaService.addMedia>[0] {
  return {
    name: 'pic',
    type: 'image',
    route,
    sfw: true,
    isAiGenerated: false
  } as Parameters<typeof mediaService.addMedia>[0]
}

describe('mediaMaintenanceService.checkMissingFiles', () => {
  it('reports zero missing when every file exists', async () => {
    const file = join(sourceDir, 'a.png')
    await fs.writeFile(file, 'hello')
    await mediaService.addMedia(baseInput(file))

    const result = await mediaMaintenanceService.checkMissingFiles()

    expect(result).toEqual({
      totalCount: 1,
      missingCount: 0,
      suggestedOldRoot: null,
      missingItems: []
    })
  })

  it('counts missing files, suggests their common root, and lists each one', async () => {
    const missingRoute = join(sourceDir, 'moved', 'a.png')
    await mediaService.addMedia(baseInput(missingRoute))
    const presentFile = join(sourceDir, 'b.png')
    await fs.writeFile(presentFile, 'hello')
    await mediaService.addMedia(baseInput(presentFile))

    const result = await mediaMaintenanceService.checkMissingFiles()

    expect(result.totalCount).toBe(2)
    expect(result.missingCount).toBe(1)
    expect(result.suggestedOldRoot).toContain('moved')
    expect(result.missingItems).toEqual([
      { id: expect.any(String), name: 'pic', route: missingRoute, type: 'image' }
    ])
  })

  it('caps the listed items at 50 while missingCount reflects the true total', async () => {
    for (let i = 0; i < 55; i += 1) {
      await mediaService.addMedia(baseInput(join(sourceDir, 'gone', `${i}.png`)))
    }

    const result = await mediaMaintenanceService.checkMissingFiles()

    expect(result.missingCount).toBe(55)
    expect(result.missingItems).toHaveLength(50)
  })
})

describe('mediaMaintenanceService.relinkMissingFiles', () => {
  it('rewrites matching routes and reports how many are still missing', async () => {
    const oldRoot = join(sourceDir, 'old')
    await fs.mkdir(oldRoot, { recursive: true })
    const missingRoute = join(oldRoot, 'a.png')
    await mediaService.addMedia(baseInput(missingRoute))

    const newRoot = join(sourceDir, 'new')
    await fs.mkdir(newRoot, { recursive: true })
    await fs.writeFile(join(newRoot, 'a.png'), 'hello')

    const result = await mediaMaintenanceService.relinkMissingFiles(oldRoot, newRoot)

    expect(result.updatedCount).toBe(1)
    expect(result.stillMissingCount).toBe(0)
  })

  // The production shape: `suggestedOldRoot` comes from findCommonPathPrefix,
  // which always ends in a separator, while `newRoot` comes from the directory
  // picker, which never does. Naive concatenation produced `E:\Newa.png`.
  it('joins correctly when the old root ends in a separator and the new root does not', async () => {
    const oldRoot = join(sourceDir, 'old') + sep
    const missingRoute = join(sourceDir, 'old', 'a.png')
    await mediaService.addMedia(baseInput(missingRoute))

    const newRoot = join(sourceDir, 'new') // no trailing separator
    await fs.mkdir(newRoot, { recursive: true })
    await fs.writeFile(join(newRoot, 'a.png'), 'hello')

    const result = await mediaMaintenanceService.relinkMissingFiles(oldRoot, newRoot)

    expect(result.updatedCount).toBe(1)
    expect(result.stillMissingCount).toBe(0)
  })

  // The old-root field is user-editable, so it can arrive without a trailing
  // separator - which must not turn the prefix match into a partial-name match.
  it('does not match a sibling folder that merely shares the old root prefix text', async () => {
    const siblingFile = join(sourceDir, 'Artwork', 'a.png')
    await fs.mkdir(join(sourceDir, 'Artwork'), { recursive: true })
    await fs.writeFile(siblingFile, 'hello')
    await mediaService.addMedia(baseInput(siblingFile))

    const result = await mediaMaintenanceService.relinkMissingFiles(
      join(sourceDir, 'Art'),
      join(sourceDir, 'New')
    )

    expect(result.updatedCount).toBe(0)
    expect(result.stillMissingCount).toBe(0)
  })

  it.skipIf(process.platform === 'linux')(
    'matches the old root case-insensitively but keeps the original casing of the remainder',
    async () => {
      const missingRoute = join(sourceDir, 'Old', 'MixedCase.png')
      await mediaService.addMedia(baseInput(missingRoute))

      const newRoot = join(sourceDir, 'new')
      await fs.mkdir(newRoot, { recursive: true })
      await fs.writeFile(join(newRoot, 'MixedCase.png'), 'hello')

      const result = await mediaMaintenanceService.relinkMissingFiles(
        join(sourceDir, 'old') + sep,
        newRoot
      )

      expect(result.updatedCount).toBe(1)
      expect(result.stillMissingCount).toBe(0)
    }
  )

  it('leaves files genuinely gone (not just moved) reported as still missing', async () => {
    const oldRoot = join(sourceDir, 'old')
    await mediaService.addMedia(baseInput(join(oldRoot, 'a.png')))

    const newRoot = join(sourceDir, 'new') // nothing actually placed here
    const result = await mediaMaintenanceService.relinkMissingFiles(oldRoot, newRoot)

    expect(result.updatedCount).toBe(1)
    expect(result.stillMissingCount).toBe(1)
  })
})

describe('mediaMaintenanceService.relinkOne', () => {
  it('sets the exact route for the given media id', async () => {
    const missingRoute = join(sourceDir, 'old', 'a.png')
    const created = await mediaService.addMedia(baseInput(missingRoute))

    const newRoute = join(sourceDir, 'new', 'renamed.png')
    const result = await mediaMaintenanceService.relinkOne(created.id, newRoute)

    expect(result).toEqual({ updated: true })
    const check = await mediaMaintenanceService.checkMissingFiles()
    expect(check.missingItems.find((item) => item.id === created.id)?.route).toBe(newRoute)
  })
})

describe('mediaMaintenanceService source folder awareness', () => {
  it('resolves a relative row against the configured source folder when checking for missing files', async () => {
    writeSourceFolder(sourceDir)
    const file = join(sourceDir, 'a.png')
    await fs.writeFile(file, 'hello')
    await mediaService.addMedia(baseInput(file))

    const result = await mediaMaintenanceService.checkMissingFiles()

    expect(result.missingCount).toBe(0)
  })

  it('reports a relative row as missing using its resolved absolute path', async () => {
    writeSourceFolder(sourceDir)
    await fs.mkdir(join(sourceDir, 'sub'), { recursive: true })
    await mediaService.addMedia(baseInput(join(sourceDir, 'sub', 'gone.png')))

    const result = await mediaMaintenanceService.checkMissingFiles()

    expect(result.missingCount).toBe(1)
    expect(result.missingItems[0].route).toBe(join(sourceDir, 'sub', 'gone.png'))
  })

  it('relinkMissingFiles moves a relative row and keeps it relative when the new location is still under the source folder', async () => {
    writeSourceFolder(sourceDir)
    const oldRoot = join(sourceDir, 'old')
    await fs.mkdir(oldRoot, { recursive: true })
    await mediaService.addMedia(baseInput(join(oldRoot, 'a.png')))

    const newRoot = join(sourceDir, 'new')
    await fs.mkdir(newRoot, { recursive: true })
    await fs.writeFile(join(newRoot, 'a.png'), 'hello')

    const result = await mediaMaintenanceService.relinkMissingFiles(oldRoot, newRoot)

    expect(result.updatedCount).toBe(1)
    expect(result.stillMissingCount).toBe(0)
    expect((await mediaMaintenanceService.checkMissingFiles()).missingCount).toBe(0)
  })

  it('relinkOne stores the new route relative to the configured source folder', async () => {
    writeSourceFolder(sourceDir)
    const created = await mediaService.addMedia(baseInput(join(sourceDir, 'old', 'a.png')))

    const newRoute = join(sourceDir, 'new', 'renamed.png')
    await mediaMaintenanceService.relinkOne(created.id, newRoute)

    const check = await mediaMaintenanceService.checkMissingFiles()
    expect(check.missingItems.find((item) => item.id === created.id)?.route).toBe(newRoute)
  })
})
