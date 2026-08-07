import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir }
}))

const { initTestDbSingleton } = await import('../database/testHelpers')
const { getDb } = await import('../database/connection')
const mediaRepo = await import('../database/repositories/media.repository')
const { writeSourceFolder, resetSourceFolderCache } = await import('./sourceFolder')
const { sourceFolderBrowserService } = await import('./sourceFolderBrowser.service')

let cleanup: () => Promise<void>
let sourceDir = ''

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'browser-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'browser-source-'))
  // readSourceFolder is module-scope cached; reset so each test starts from
  // its own fresh userData dir rather than an earlier test's cached value.
  resetSourceFolderCache()
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
  writeSourceFolder(sourceDir)
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

async function insertRow(route: string): Promise<void> {
  await mediaRepo.insertMediaRow(getDb(), {
    id: randomUUID(),
    name: 'pic',
    sfw: 1,
    is_ai_generated: 0,
    type: 'image',
    route,
    alias: null,
    artist_id: null,
    created_at: Date.now(),
    hash: null,
    phash: null
  })
}

describe('sourceFolderBrowserService.browse', () => {
  it('lists supported media files and subfolders, hiding unsupported files', async () => {
    await fs.mkdir(join(sourceDir, 'sub'))
    await fs.writeFile(join(sourceDir, 'a.png'), 'x')
    await fs.writeFile(join(sourceDir, 'notes.txt'), 'x')

    const result = await sourceFolderBrowserService.browse('')

    expect(result.folders).toEqual([{ name: 'sub', relativePath: 'sub' }])
    expect(result.files).toEqual([
      { name: 'a.png', relativePath: 'a.png', type: 'image', cataloged: false }
    ])
  })

  it('marks a file already cataloged in the DB', async () => {
    await fs.writeFile(join(sourceDir, 'a.png'), 'x')
    await insertRow('a.png')

    const result = await sourceFolderBrowserService.browse('')

    expect(result.files[0]).toEqual({
      name: 'a.png',
      relativePath: 'a.png',
      type: 'image',
      cataloged: true
    })
  })

  it('lists the contents of a nested subfolder by relative path', async () => {
    await fs.mkdir(join(sourceDir, 'sub'))
    await fs.writeFile(join(sourceDir, 'sub', 'b.mp4'), 'x')

    const result = await sourceFolderBrowserService.browse('sub')

    expect(result.files).toEqual([
      { name: 'b.mp4', relativePath: join('sub', 'b.mp4'), type: 'video', cataloged: false }
    ])
  })

  it('rejects a relative path that tries to escape the source folder', async () => {
    await expect(sourceFolderBrowserService.browse('..')).rejects.toThrow(
      'outside the configured source folder'
    )
  })

  it('throws when no source folder is configured', async () => {
    writeSourceFolder(null)

    await expect(sourceFolderBrowserService.browse('')).rejects.toThrow(
      'No source folder is configured.'
    )
  })
})

describe('sourceFolderBrowserService.expandSelection', () => {
  it('resolves loose selected files to absolute routes', async () => {
    await fs.writeFile(join(sourceDir, 'a.png'), 'x')

    const result = await sourceFolderBrowserService.expandSelection({ files: ['a.png'], folders: [] })

    expect(result).toEqual([{ route: join(sourceDir, 'a.png'), fileName: 'a.png', type: 'image' }])
  })

  it('expands a selected folder recursively, skipping unsupported files', async () => {
    await fs.mkdir(join(sourceDir, 'sub', 'deep'), { recursive: true })
    await fs.writeFile(join(sourceDir, 'sub', 'a.png'), 'x')
    await fs.writeFile(join(sourceDir, 'sub', 'deep', 'b.mp4'), 'x')
    await fs.writeFile(join(sourceDir, 'sub', 'skip.txt'), 'x')

    const result = await sourceFolderBrowserService.expandSelection({ files: [], folders: ['sub'] })

    expect(result).toEqual(
      expect.arrayContaining([
        { route: join(sourceDir, 'sub', 'a.png'), fileName: 'a.png', type: 'image' },
        { route: join(sourceDir, 'sub', 'deep', 'b.mp4'), fileName: 'b.mp4', type: 'video' }
      ])
    )
    expect(result).toHaveLength(2)
  })

  it('excludes files already cataloged in the DB, even inside a recursively selected folder', async () => {
    await fs.mkdir(join(sourceDir, 'sub'))
    await fs.writeFile(join(sourceDir, 'sub', 'a.png'), 'x')
    await fs.writeFile(join(sourceDir, 'sub', 'b.png'), 'x')
    await insertRow(join('sub', 'a.png'))

    const result = await sourceFolderBrowserService.expandSelection({ files: [], folders: ['sub'] })

    expect(result).toEqual([{ route: join(sourceDir, 'sub', 'b.png'), fileName: 'b.png', type: 'image' }])
  })

  it('dedupes a file reachable both directly and via a selected ancestor folder', async () => {
    await fs.mkdir(join(sourceDir, 'sub'))
    await fs.writeFile(join(sourceDir, 'sub', 'a.png'), 'x')

    const result = await sourceFolderBrowserService.expandSelection({
      files: [join('sub', 'a.png')],
      folders: ['sub']
    })

    expect(result).toHaveLength(1)
  })
})
