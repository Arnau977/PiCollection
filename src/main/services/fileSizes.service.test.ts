import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir, isPackaged: false },
  shell: { trashItem: vi.fn() }
}))
vi.mock('../events/entityEvents', () => ({ notifyEntitiesChanged: vi.fn() }))

const { initTestDbSingleton } = await import('../database/testHelpers')
const { getDb } = await import('../database/connection')
const mediaRepo = await import('../database/repositories/media.repository')
const { writeSourceFolder, resetSourceFolderCache } = await import('./sourceFolder')
const { mediaService } = await import('./media.service')
const { readNewFileSizes } = await import('./fileSizes.service')

let cleanup: () => Promise<void>
let sourceDir = ''

async function addFile(name: string, bytes: number): Promise<string> {
  const path = join(sourceDir, name)
  await fs.writeFile(path, Buffer.alloc(bytes, name.charCodeAt(0)))
  const media = await mediaService.addMedia({
    name,
    type: 'image',
    route: path,
    sfw: true,
    isAiGenerated: false
  })
  return media.id
}

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'file-sizes-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'file-sizes-source-'))
  resetSourceFolderCache()
  cleanup = (await initTestDbSingleton()).cleanup
  writeSourceFolder(sourceDir)
})

afterEach(async () => {
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('readNewFileSizes', () => {
  it('reads each file once, skips missing ones, and lets the gallery sort by size', async () => {
    const small = await addFile('small.png', 10)
    const big = await addFile('big.png', 300)
    const gone = await addFile('gone.png', 50)
    await fs.rm(join(sourceDir, 'gone.png'))

    await readNewFileSizes()

    const db = getDb()
    const rows = await mediaRepo.findMediaRows(db, {}, { prop: 'fileSize', desc: true })
    expect(rows.map((row) => [row.id, row.file_size])).toEqual([
      [big, 300],
      [small, 10],
      // Unknown sizes come last when sorting from the heaviest.
      [gone, null]
    ])
  })
})
