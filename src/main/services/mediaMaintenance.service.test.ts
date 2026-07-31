import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// mediaService.addMedia hashes the candidate file, which for a real
// (non-mocked) file also tries to generate a perceptual hash off its
// thumbnail - that goes through Electron's nativeImage, unavailable outside
// a real Electron process, so it's stubbed the same way
// media.service.duplicate.test.ts does.
vi.mock('electron', () => ({
  app: { getPath: () => '' },
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

let cleanup: () => Promise<void>
let sourceDir = ''

beforeEach(async () => {
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'maintenance-test-'))
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
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

    expect(result).toEqual({ totalCount: 1, missingCount: 0, suggestedOldRoot: null })
  })

  it('counts missing files and suggests their common root', async () => {
    const missingRoute = join(sourceDir, 'moved', 'a.png')
    await mediaService.addMedia(baseInput(missingRoute))
    const presentFile = join(sourceDir, 'b.png')
    await fs.writeFile(presentFile, 'hello')
    await mediaService.addMedia(baseInput(presentFile))

    const result = await mediaMaintenanceService.checkMissingFiles()

    expect(result.totalCount).toBe(2)
    expect(result.missingCount).toBe(1)
    expect(result.suggestedOldRoot).toContain('moved')
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

  it('leaves files genuinely gone (not just moved) reported as still missing', async () => {
    const oldRoot = join(sourceDir, 'old')
    await mediaService.addMedia(baseInput(join(oldRoot, 'a.png')))

    const newRoot = join(sourceDir, 'new') // nothing actually placed here
    const result = await mediaMaintenanceService.relinkMissingFiles(oldRoot, newRoot)

    expect(result.updatedCount).toBe(1)
    expect(result.stillMissingCount).toBe(1)
  })
})
