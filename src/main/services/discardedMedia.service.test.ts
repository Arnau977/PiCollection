import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''
const trashItem = vi.fn()

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
  shell: { trashItem: (...args: unknown[]) => trashItem(...args) }
}))
vi.mock('../events/entityEvents', () => ({ notifyEntitiesChanged: vi.fn() }))

const { initTestDbSingleton } = await import('../database/testHelpers')
const { writeSourceFolder, resetSourceFolderCache } = await import('./sourceFolder')
const { discardedMediaService } = await import('./discardedMedia.service')
const { mediaService } = await import('./media.service')
const { sourceFolderBrowserService } = await import('./sourceFolderBrowser.service')

let cleanup: () => Promise<void>
let sourceDir = ''

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'discarded-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'discarded-source-'))
  resetSourceFolderCache()
  cleanup = (await initTestDbSingleton()).cleanup
  writeSourceFolder(sourceDir)
  trashItem.mockReset().mockResolvedValue(undefined)
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('discarded media', () => {
  it('lists a file discarded from the batch import and leaves it out of the next import', async () => {
    const route = join(sourceDir, 'a.png')
    await fs.writeFile(route, 'x')
    await fs.writeFile(join(sourceDir, 'b.png'), 'x')

    await discardedMediaService.discardFile({ route, name: 'a', type: 'image' })
    const selection = await sourceFolderBrowserService.expandSelection({
      files: ['a.png', 'b.png'],
      folders: []
    })

    expect(await discardedMediaService.list()).toMatchObject([
      { route: 'a.png', name: 'a', reason: 'deleted' }
    ])
    expect(selection.files.map((file) => file.fileName)).toEqual(['b.png'])
    expect(selection.skippedDiscarded).toBe(1)
  })

  it('records deleted media, and forgets it once the same file is added again', async () => {
    const input = {
      name: 'a',
      type: 'image' as const,
      route: join(sourceDir, 'a.png'),
      sfw: true,
      isAiGenerated: false
    }
    const media = await mediaService.addMedia(input)

    await mediaService.deleteMedia(media.id)
    expect((await discardedMediaService.list()).map((item) => item.route)).toEqual(['a.png'])

    await mediaService.addMedia(input)
    expect(await discardedMediaService.list()).toEqual([])
  })

  it('moves existing files to the Recycle Bin, forgets missing ones, and keeps a failed one listed until kept', async () => {
    await fs.writeFile(join(sourceDir, 'here.png'), 'x')
    await fs.writeFile(join(sourceDir, 'stuck.png'), 'x')
    for (const name of ['here', 'gone', 'stuck']) {
      await discardedMediaService.discardFile({
        route: join(sourceDir, `${name}.png`),
        name,
        type: 'image'
      })
    }
    trashItem.mockImplementation(async (path: string) => {
      if (path.endsWith('stuck.png')) throw new Error('in use')
    })

    const ids = (await discardedMediaService.list()).map((item) => item.id)
    const result = await discardedMediaService.trashFiles(ids)

    expect(result).toEqual({ trashed: 2, failed: 1 })
    expect(trashItem).toHaveBeenCalledTimes(2) // 'gone' never existed
    const [stuck] = await discardedMediaService.list()
    expect(stuck.name).toBe('stuck')

    await discardedMediaService.keepFile(stuck.id)
    expect(await discardedMediaService.list()).toEqual([])
    expect(trashItem).toHaveBeenCalledTimes(2)
  })
})
