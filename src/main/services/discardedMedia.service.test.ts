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
const { getDb } = await import('../database/connection')
const { isDiscarded } = await import('../database/repositories/discardedMedia.repository')
const { computeFileHash, computePerceptualHash } = await import('./mediaHash')
const mediaRepo = await import('../database/repositories/media.repository')
const { default: sharp } = await import('sharp')

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

async function savedMedia(name: string, pendingTagging = false): Promise<{ id: string }> {
  const media = await mediaService.addMedia({
    name,
    type: 'image',
    route: join(sourceDir, `${name}.png`),
    sfw: true,
    isAiGenerated: false
  })
  if (pendingTagging) {
    await getDb()
      .updateTable('media')
      .set({ pending_tagging: 1 })
      .where('id', '=', media.id)
      .execute()
  }
  return media
}

async function reasonAfterDeleting(id: string): Promise<string> {
  await mediaService.deleteMedia(id)
  return (await discardedMediaService.list())[0].reason
}

describe('why a media was discarded', () => {
  it('is a repeat when another media holds the same bytes', async () => {
    const [kept, copy] = [await savedMedia('kept'), await savedMedia('copy')]
    await mediaRepo.setMediaHash(getDb(), kept.id, 'same', null)
    await mediaRepo.setMediaHash(getDb(), copy.id, 'same', null)

    expect(await reasonAfterDeleting(copy.id)).toBe('duplicate')
  })

  it('is a variant when another media looks like it', async () => {
    const [kept, censored] = [await savedMedia('kept'), await savedMedia('censored')]
    await mediaRepo.setMediaHash(getDb(), kept.id, 'one', '0000000000000000')
    await mediaRepo.setMediaHash(getDb(), censored.id, 'two', '1000000000000000')

    expect(await reasonAfterDeleting(censored.id)).toBe('variant')
  })

  it('stays a plain delete when nothing resembles it', async () => {
    const [other, lone] = [await savedMedia('other'), await savedMedia('lone')]
    await mediaRepo.setMediaHash(getDb(), other.id, 'one', 'ffffffffffffffff')
    await mediaRepo.setMediaHash(getDb(), lone.id, 'two', '0000000000000000')

    expect(await reasonAfterDeleting(lone.id)).toBe('deleted')
  })

  it('does not count the video a GIF was made from as a variant', async () => {
    const [video, gif] = [await savedMedia('video'), await savedMedia('gif')]
    await getDb()
      .updateTable('media')
      .set({ derived_from_id: video.id })
      .where('id', '=', gif.id)
      .execute()

    expect(await reasonAfterDeleting(gif.id)).toBe('deleted')
  })

  it('counts pending media only for a pending media, like the warning it showed', async () => {
    const [waiting, library] = [await savedMedia('waiting', true), await savedMedia('library')]
    await mediaRepo.setMediaHash(getDb(), waiting.id, 'one', '0000000000000000')
    await mediaRepo.setMediaHash(getDb(), library.id, 'two', '1000000000000000')

    expect(await reasonAfterDeleting(library.id)).toBe('deleted')
  })

  it('keeps the reason once the other media is gone', async () => {
    const [kept, copy] = [await savedMedia('kept'), await savedMedia('copy')]
    await mediaRepo.setMediaHash(getDb(), kept.id, 'same', null)
    await mediaRepo.setMediaHash(getDb(), copy.id, 'same', null)

    await mediaService.deleteMedia(copy.id)
    await mediaService.deleteMedia(kept.id)

    const reasons = (await discardedMediaService.list()).map((item) => [item.name, item.reason])
    expect(reasons).toContainEqual(['copy', 'duplicate'])
    expect(reasons).toContainEqual(['kept', 'deleted'])
  })

  it('is a repeat for a batch-import file already in the app', async () => {
    const route = join(sourceDir, 'new.png')
    await fs.writeFile(route, 'picture bytes')
    const kept = await savedMedia('kept')
    await mediaRepo.setMediaHash(getDb(), kept.id, await computeFileHash(route), null)

    await mediaService.discardFile({ route, name: 'new', type: 'image' })

    expect((await discardedMediaService.list())[0].reason).toBe('duplicate')
  })

  it('is a variant for a batch-import file that looks like a saved media', async () => {
    const route = join(sourceDir, 'new.png')
    await sharp({ create: { width: 64, height: 64, channels: 3, background: '#336699' } })
      .png()
      .toFile(route)
    const kept = await savedMedia('kept')
    const print = await computePerceptualHash(route)
    await mediaRepo.setMediaHash(getDb(), kept.id, 'other bytes', print?.phash ?? null)

    await mediaService.discardFile({ route, name: 'new', type: 'image' })

    expect((await discardedMediaService.list())[0].reason).toBe('variant')
  })
})

describe('discarded media', () => {
  it('lists a file discarded from the batch import and leaves it out of the next import', async () => {
    const route = join(sourceDir, 'a.png')
    await fs.writeFile(route, 'x')
    await fs.writeFile(join(sourceDir, 'b.png'), 'x')

    await mediaService.discardFile({ route, name: 'a', type: 'image' })
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

  it('keeps the hash of a deleted media, so a moved copy is still known as discarded', async () => {
    const route = join(sourceDir, 'a.png')
    await fs.writeFile(route, 'picture bytes')
    const hash = await computeFileHash(route)
    const media = await mediaService.addMedia({
      name: 'a',
      type: 'image',
      route,
      sfw: true,
      isAiGenerated: false
    })

    await mediaService.deleteMedia(media.id)

    expect(await isDiscarded(getDb(), { route: 'elsewhere/x.png', hash })).toBe(true)
    expect(await isDiscarded(getDb(), { route: 'elsewhere/x.png', hash: 'zzz' })).toBe(false)
  })

  it('hashes a never-saved batch-import file when it is discarded', async () => {
    const route = join(sourceDir, 'b.png')
    await fs.writeFile(route, 'other bytes')

    await mediaService.discardFile({ route, name: 'b', type: 'image' })

    const row = await getDb().selectFrom('discarded_media').selectAll().executeTakeFirstOrThrow()
    expect(row.hash).toBe(await computeFileHash(route))
  })

  it('moves existing files to the Recycle Bin, forgets missing ones, and keeps a failed one listed until kept', async () => {
    await fs.writeFile(join(sourceDir, 'here.png'), 'x')
    await fs.writeFile(join(sourceDir, 'stuck.png'), 'x')
    for (const name of ['here', 'gone', 'stuck']) {
      await mediaService.discardFile({
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
