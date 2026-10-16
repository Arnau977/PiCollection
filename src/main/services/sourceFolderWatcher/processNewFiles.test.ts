import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir, isPackaged: false },
  shell: { trashItem: vi.fn() }
}))
vi.mock('../../events/entityEvents', () => ({ notifyEntitiesChanged: vi.fn() }))

const { initTestDbSingleton } = await import('../../database/testHelpers')
const { getDb } = await import('../../database/connection')
const { writeSourceFolder, resetSourceFolderCache, relativizeRoute } = await import(
  '../sourceFolder'
)
const { mediaService } = await import('../media.service')
const { discardedMediaService } = await import('../discardedMedia.service')
const { processNewFiles } = await import('./processNewFiles')
const { setAutoImport, resetWatcherSettingsCache } = await import('./watcherSettings')

let cleanup: () => Promise<void>
let sourceDir = ''

async function write(relative: string, bytes: string): Promise<string> {
  const path = join(sourceDir, relative)
  await fs.mkdir(join(path, '..'), { recursive: true })
  await fs.writeFile(path, bytes)
  return path
}

async function addLibraryMedia(path: string): Promise<string> {
  const media = await mediaService.addMedia({
    name: 'x',
    type: 'image',
    route: path,
    sfw: true,
    isAiGenerated: false
  })
  return media.id
}

async function mediaRows(): Promise<{ route: string; pending_tagging: number; sfw: number }[]> {
  return getDb().selectFrom('media').select(['route', 'pending_tagging', 'sfw']).execute()
}

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'watcher-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'watcher-source-'))
  resetSourceFolderCache()
  resetWatcherSettingsCache()
  cleanup = (await initTestDbSingleton()).cleanup
  writeSourceFolder(sourceDir)
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('processNewFiles', () => {
  it('relinks a moved library file', async () => {
    const oldPath = await write('a/x.png', 'tagged picture')
    const id = await addLibraryMedia(oldPath)
    const newPath = join(sourceDir, 'b', 'x.png')
    await fs.mkdir(join(sourceDir, 'b'))
    await fs.rename(oldPath, newPath)

    expect(await processNewFiles([newPath])).toEqual({ relinked: 1, imported: 0, unimported: 0 })
    expect((await mediaService.getMediaById(id))?.route).toBe(relativizeRoute(newPath, sourceDir))
    expect(await mediaRows()).toHaveLength(1)
  })

  it('skips a copy of a file still in the library', async () => {
    await addLibraryMedia(await write('a/x.png', 'tagged picture'))
    const copy = await write('b/x.png', 'tagged picture')
    setAutoImport(true, 0)

    expect(await processNewFiles([copy])).toEqual({ relinked: 0, imported: 0, unimported: 0 })
    expect(await mediaRows()).toHaveLength(1)
  })

  it('skips a file discarded by hash, and one discarded by route', async () => {
    const byHash = await write('a/gone.png', 'discarded bytes')
    await discardedMediaService.discardFile({ route: byHash, name: 'gone', type: 'image' })
    await fs.rm(byHash)
    const moved = await write('b/moved.png', 'discarded bytes')

    const byRoute = await write('c/old.png', 'other bytes')
    await getDb()
      .insertInto('discarded_media')
      .values({
        id: 'r1',
        route: relativizeRoute(byRoute, sourceDir),
        name: 'old',
        type: 'image',
        reason: 'deleted',
        discarded_at: 1,
        hash: null
      })
      .execute()
    setAutoImport(true, 0)

    expect(await processNewFiles([moved, byRoute])).toEqual({
      relinked: 0,
      imported: 0,
      unimported: 0
    })
  })

  it('imports a new file to Pending when auto-import is on', async () => {
    const path = await write('saved/new.png', 'fresh picture')
    setAutoImport(true, 0)

    expect(await processNewFiles([path])).toEqual({ relinked: 0, imported: 1, unimported: 0 })
    expect(await mediaRows()).toEqual([
      { route: relativizeRoute(path, sourceDir), pending_tagging: 1, sfw: 1 }
    ])
  })

  it('does not import a file created before auto-import was enabled', async () => {
    const path = await write('backlog/old.png', 'backlog picture')
    setAutoImport(true, Date.now() + 60_000)

    expect(await processNewFiles([path])).toEqual({ relinked: 0, imported: 0, unimported: 1 })
    expect(await mediaRows()).toEqual([])
  })

  it('counts but does not import new files when auto-import is off', async () => {
    const path = await write('saved/new.png', 'fresh picture')

    expect(await processNewFiles([path])).toEqual({ relinked: 0, imported: 0, unimported: 1 })
  })

  it('ignores non-media files and files that are already gone', async () => {
    const text = await write('notes.txt', 'text')
    setAutoImport(true, 0)

    expect(await processNewFiles([text, join(sourceDir, 'vanished.png')])).toEqual({
      relinked: 0,
      imported: 0,
      unimported: 0
    })
  })
})
