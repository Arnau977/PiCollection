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
const { writeSourceFolder, resetSourceFolderCache } = await import('./sourceFolder')
const { mediaService } = await import('./media.service')
const { tagService } = await import('./tag.service')
const { videoGifService } = await import('./videoGif.service')

let cleanup: () => Promise<void>
let sourceDir = ''

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'video-gif-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'video-gif-src-'))
  resetSourceFolderCache()
  writeSourceFolder(sourceDir)
  cleanup = (await initTestDbSingleton()).cleanup
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('videoGifService.createFromVideo', () => {
  it('saves the GIF next to the video, never overwriting, with the video metadata', async () => {
    const videoPath = join(sourceDir, 'clip.mp4')
    await fs.writeFile(videoPath, 'video bytes')
    await fs.writeFile(join(sourceDir, 'clip (GIF).gif'), 'an earlier gif')
    const tag = await tagService.createTag({ name: 'Swimsuit' })
    const video = await mediaService.addMedia({
      name: 'clip',
      type: 'video',
      route: videoPath,
      sfw: false,
      isAiGenerated: false,
      tagIds: [tag.id],
      sourceUrl: 'https://example.com/post/1'
    })

    const gif = await videoGifService.createFromVideo(video.id, new Uint8Array([71, 73, 70]))

    expect(gif).toMatchObject({
      type: 'gif',
      name: 'clip (GIF)',
      sfw: false,
      pendingTagging: false,
      sourceUrl: 'https://example.com/post/1'
    })
    expect(gif.tags?.map((t) => t.id)).toEqual([tag.id])
    expect(await fs.readFile(join(sourceDir, 'clip (GIF 2).gif'), 'utf8')).toBe('GIF')
  })
})
