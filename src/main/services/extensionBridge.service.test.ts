import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { AppError } from '../errors'

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
const { extensionBridgeService } = await import('./extensionBridge.service')
const { writeSourceFolder, resetSourceFolderCache } = await import('./sourceFolder')
const { artistService } = await import('./artist.service')
const { tagService } = await import('./tag.service')
const { characterService } = await import('./character.service')
const { seriesService } = await import('./series.service')
const { mediaService } = await import('./media.service')

let cleanup: () => Promise<void>
let sourceDir = ''

function baseCapture(
  overrides: Record<string, unknown> = {}
): Parameters<typeof extensionBridgeService.capture>[0] {
  return {
    fileDataBase64: Buffer.from('hello world').toString('base64'),
    fileName: 'post.jpg',
    mediaType: 'image',
    sourceUrl: 'https://example.com/post/1',
    sourceSite: 'danbooru',
    ...overrides
  } as Parameters<typeof extensionBridgeService.capture>[0]
}

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'ext-bridge-svc-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'ext-bridge-svc-src-'))
  resetSourceFolderCache()
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('extensionBridgeService.capture', () => {
  it('throws NO_SOURCE_FOLDER when none is configured', async () => {
    await expect(extensionBridgeService.capture(baseCapture())).rejects.toMatchObject(
      new AppError('NO_SOURCE_FOLDER', 'Configure a source folder in PiCollection first.')
    )
  })

  it('writes the file under <sourceFolder>/Web Imports/<site>/ and creates the media', async () => {
    writeSourceFolder(sourceDir)

    const result = await extensionBridgeService.capture(baseCapture())

    expect(result.status).toBe('created')
    const files = await fs.readdir(join(sourceDir, 'Web Imports', 'danbooru'))
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/post\.jpg$/)
  })

  it('sanitizes a path-traversal sourceSite instead of escaping the source folder', async () => {
    writeSourceFolder(sourceDir)

    const result = await extensionBridgeService.capture(baseCapture({ sourceSite: '../../evil' }))

    expect(result.status).toBe('created')
    const webImportsDir = join(sourceDir, 'Web Imports')
    const siteDirs = await fs.readdir(webImportsDir)
    // A single sanitized directory landed inside Web Imports/ - the '/'
    // separators were replaced, so this can't be interpreted as '..' by
    // the filesystem even though the dots survive the allowlist.
    expect(siteDirs).toEqual(['.._.._evil'])
    const files = await fs.readdir(join(webImportsDir, '.._.._evil'))
    expect(files).toHaveLength(1)
  })

  it('cleans up the written file if a failure occurs after it lands on disk', async () => {
    writeSourceFolder(sourceDir)
    const { mediaService } = await import('./media.service')
    const addMediaSpy = vi.spyOn(mediaService, 'addMedia').mockRejectedValueOnce(new Error('boom'))

    await expect(extensionBridgeService.capture(baseCapture())).rejects.toThrow('boom')

    const files = await fs.readdir(join(sourceDir, 'Web Imports', 'danbooru')).catch(() => [])
    expect(files).toHaveLength(0)

    addMediaSpy.mockRestore()
  })

  it('never creates entities for unknown names, keeping them as source metadata', async () => {
    writeSourceFolder(sourceDir)

    const result = await extensionBridgeService.capture(
      baseCapture({
        artistName: 'Some Artist',
        tagNames: ['   ', 'closed_eyes'],
        characterNames: ['usada_pekora'],
        seriesNames: ['hololive']
      })
    )

    expect(await artistService.getAllArtists()).toEqual([])
    expect(await tagService.getAllTags()).toEqual([])
    expect(await characterService.getAllCharacters()).toEqual([])
    expect(await seriesService.getAllSeries()).toEqual([])
    const media = await mediaService.getMediaById(result.mediaId)
    expect(media?.sourceMetadata).toEqual({
      site: 'danbooru',
      artist: 'Some Artist',
      tags: ['closed_eyes'],
      characters: ['usada_pekora'],
      series: ['hololive']
    })
  })

  it('stores the raw sourceMetadata payload over the names it links', async () => {
    writeSourceFolder(sourceDir)
    const tag = await tagService.createTag({ name: 'Closed eyes' })

    const result = await extensionBridgeService.capture(
      baseCapture({
        tagNames: ['closed_eyes'],
        sourceMetadata: { tags: ['closed_eyes', 'rabbit_ears'], characters: [], series: [] }
      })
    )

    const media = await mediaService.getMediaById(result.mediaId)
    expect(media?.tags?.map((t) => t.id)).toEqual([tag.id])
    expect(media?.sourceMetadata?.tags).toEqual(['closed_eyes', 'rabbit_ears'])
  })

  it('reuses an existing artist matched case-insensitively', async () => {
    writeSourceFolder(sourceDir)
    const existing = await artistService.createArtist({ name: 'Some Artist' })

    await extensionBridgeService.capture(baseCapture({ artistName: 'some artist' }))

    const artists = await artistService.getAllArtists()
    expect(artists.filter((a) => a.name.toLowerCase() === 'some artist')).toHaveLength(1)
    expect(artists[0].id).toBe(existing.id)
  })

  it('links case-variant duplicates of an existing tag once, not an error', async () => {
    writeSourceFolder(sourceDir)
    const tag = await tagService.createTag({ name: 'rating:safe' })

    const result = await extensionBridgeService.capture(
      baseCapture({ tagNames: ['rating:safe', 'Rating:Safe'] })
    )

    expect(result.status).toBe('created')
    const media = await mediaService.getMediaById(result.mediaId)
    expect(media?.tags?.map((t) => t.id)).toEqual([tag.id])
  })

  it('returns duplicate status without creating a second row for identical bytes', async () => {
    writeSourceFolder(sourceDir)
    const first = await extensionBridgeService.capture(baseCapture())

    const second = await extensionBridgeService.capture(
      baseCapture({ fileName: 'different-name.jpg' })
    )

    expect(second.status).toBe('duplicate')
    expect(second.mediaId).toBe(first.status === 'created' ? first.mediaId : undefined)
  })

  it('defaults pendingTagging to true when not specified', async () => {
    writeSourceFolder(sourceDir)

    const result = await extensionBridgeService.capture(baseCapture())

    expect(result.status).toBe('created')
    const { mediaService } = await import('./media.service')
    const created =
      result.status === 'created' ? await mediaService.getMediaById(result.mediaId) : null
    expect(created?.pendingTagging).toBe(true)
    expect(created?.sourceUrl).toBe('https://example.com/post/1')
  })
})

describe('extensionBridgeService.lookup', () => {
  it('returns name matches, case-insensitive substring', async () => {
    writeSourceFolder(sourceDir)
    await artistService.createArtist({ name: 'Yoshitaka Amano' })
    await artistService.createArtist({ name: 'Someone Else' })

    const matches = await extensionBridgeService.lookup('artist', 'amano')

    expect(matches.map((m) => m.name)).toEqual(['Yoshitaka Amano'])
  })

  it('flags the entity capture would link, ignoring booru underscores', async () => {
    writeSourceFolder(sourceDir)
    await tagService.createTag({ name: 'Closed eyes' })

    const matches = await extensionBridgeService.lookup('tag', 'closed_eyes')

    expect(matches).toEqual([expect.objectContaining({ name: 'Closed eyes', exact: true })])
  })

  it('flags a character stored without the Danbooru series qualifier', async () => {
    writeSourceFolder(sourceDir)
    await characterService.createCharacter({ name: 'Sylphiette' })

    const matches = await extensionBridgeService.lookup('character', 'sylphiette_(mushoku_tensei)')

    expect(matches).toEqual([expect.objectContaining({ name: 'Sylphiette', exact: true })])
  })
})

describe('extensionBridgeService.capture name matching', () => {
  it('links booru-style tags to existing ones instead of creating duplicates', async () => {
    writeSourceFolder(sourceDir)
    const existing = await tagService.createTag({ name: 'Closed eyes' })

    await extensionBridgeService.capture(baseCapture({ tagNames: ['closed_eyes'] }))

    const tags = await tagService.getAllTags()
    expect(tags.map((t) => t.id)).toEqual([existing.id])
  })

  it('matches tags by alias', async () => {
    writeSourceFolder(sourceDir)
    const existing = await tagService.createTag({ name: 'Nude', aliases: ['completely_nude'] })

    await extensionBridgeService.capture(baseCapture({ tagNames: ['completely_nude'] }))

    expect((await tagService.getAllTags()).map((t) => t.id)).toEqual([existing.id])
  })

  it('does not strip qualifiers from general tags', async () => {
    writeSourceFolder(sourceDir)
    await tagService.createTag({ name: 'Bow' })

    const result = await extensionBridgeService.capture(baseCapture({ tagNames: ['bow_(weapon)'] }))

    expect((await mediaService.getMediaById(result.mediaId))?.tags).toEqual([])
  })

  it('links a qualified character to the unqualified existing one', async () => {
    writeSourceFolder(sourceDir)
    const existing = await characterService.createCharacter({ name: 'Sylphiette' })

    await extensionBridgeService.capture(
      baseCapture({ characterNames: ['sylphiette_(mushoku_tensei)'] })
    )

    expect((await characterService.getAllCharacters()).map((c) => c.id)).toEqual([existing.id])
  })

  it('links the first known artist of a comma-joined list', async () => {
    writeSourceFolder(sourceDir)
    const known = await artistService.createArtist({ name: 'sketchdrif' })

    await extensionBridgeService.capture(baseCapture({ artistName: 'keihh, sketchdrif' }))

    expect((await artistService.getAllArtists()).map((a) => a.id)).toEqual([known.id])
  })
})

describe('ExtensionBridgeCaptureInputSchema', () => {
  it('accepts a minimal valid payload', async () => {
    const { ExtensionBridgeCaptureInputSchema } = await import('./extensionBridge.service')
    const result = ExtensionBridgeCaptureInputSchema.safeParse(baseCapture())
    expect(result.success).toBe(true)
  })

  it('rejects a payload with an invalid mediaType', async () => {
    const { ExtensionBridgeCaptureInputSchema } = await import('./extensionBridge.service')
    const result = ExtensionBridgeCaptureInputSchema.safeParse(baseCapture({ mediaType: 'audio' }))
    expect(result.success).toBe(false)
  })

  it('rejects a payload missing required fields', async () => {
    const { ExtensionBridgeCaptureInputSchema } = await import('./extensionBridge.service')
    const result = ExtensionBridgeCaptureInputSchema.safeParse({ fileName: 'a.jpg' })
    expect(result.success).toBe(false)
  })

  it('rejects a literal empty string in tagNames/characterNames/seriesNames', async () => {
    const { ExtensionBridgeCaptureInputSchema } = await import('./extensionBridge.service')
    expect(
      ExtensionBridgeCaptureInputSchema.safeParse(baseCapture({ tagNames: [''] })).success
    ).toBe(false)
    expect(
      ExtensionBridgeCaptureInputSchema.safeParse(baseCapture({ characterNames: [''] })).success
    ).toBe(false)
    expect(
      ExtensionBridgeCaptureInputSchema.safeParse(baseCapture({ seriesNames: [''] })).success
    ).toBe(false)
  })

  it('rejects a non-http(s) sourceUrl', async () => {
    const { ExtensionBridgeCaptureInputSchema } = await import('./extensionBridge.service')
    const result = ExtensionBridgeCaptureInputSchema.safeParse(
      baseCapture({ sourceUrl: 'javascript:alert(1)' })
    )
    expect(result.success).toBe(false)
  })
})
