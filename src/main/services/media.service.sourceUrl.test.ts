import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

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
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'media-sourceurl-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'media-sourceurl-src-'))
  resetSourceFolderCache()
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('mediaService sourceUrl', () => {
  it('persists and returns sourceUrl on creation', async () => {
    const file = join(sourceDir, 'a.png')
    await fs.writeFile(file, 'hello world')

    const created = await mediaService.addMedia({
      name: 'My media',
      type: 'image',
      route: file,
      sfw: true,
      isAiGenerated: false,
      sourceUrl: 'https://example.com/post/1'
    })

    expect(created.sourceUrl).toBe('https://example.com/post/1')
    const reloaded = await mediaService.getMediaById(created.id)
    expect(reloaded?.sourceUrl).toBe('https://example.com/post/1')
  })

  it('leaves sourceUrl undefined when not provided', async () => {
    const file = join(sourceDir, 'b.png')
    await fs.writeFile(file, 'no source')

    const created = await mediaService.addMedia({
      name: 'My media',
      type: 'image',
      route: file,
      sfw: true,
      isAiGenerated: false
    })

    expect(created.sourceUrl).toBeUndefined()
  })

  it('updates sourceUrl via updateMedia', async () => {
    const file = join(sourceDir, 'c.png')
    await fs.writeFile(file, 'to be edited')
    const created = await mediaService.addMedia({
      name: 'My media',
      type: 'image',
      route: file,
      sfw: true,
      isAiGenerated: false
    })

    const updated = await mediaService.updateMedia(created.id, {
      name: 'My media',
      type: 'image',
      route: file,
      sfw: true,
      isAiGenerated: false,
      sourceUrl: 'https://example.com/edited'
    })

    expect(updated.sourceUrl).toBe('https://example.com/edited')
  })
})
