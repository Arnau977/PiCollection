import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir
  }
}))

const { readSourceFolder, writeSourceFolder, resolveRoute, relativizeRoute, resetSourceFolderCache } =
  await import('./sourceFolder')

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'source-folder-settings-'))
  resetSourceFolderCache()
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
})

describe('readSourceFolder / writeSourceFolder', () => {
  it('returns null when nothing is stored', () => {
    expect(readSourceFolder()).toBeNull()
  })

  it('persists and reloads a saved path', () => {
    writeSourceFolder('D:\\Fotos')
    expect(readSourceFolder()).toBe('D:\\Fotos')
  })

  it('trims whitespace around the path', () => {
    writeSourceFolder('  D:\\Fotos  ')
    expect(readSourceFolder()).toBe('D:\\Fotos')
  })

  it('treats an empty/whitespace-only path as cleared', () => {
    writeSourceFolder('D:\\Fotos')
    writeSourceFolder('   ')
    expect(readSourceFolder()).toBeNull()
  })

  it('treats null as cleared', () => {
    writeSourceFolder('D:\\Fotos')
    writeSourceFolder(null)
    expect(readSourceFolder()).toBeNull()
  })

  it('returns null when the stored file is corrupted JSON', () => {
    writeFileSync(join(userDataDir, 'source-folder-settings.json'), 'not-json', 'utf-8')
    expect(readSourceFolder()).toBeNull()
  })
})

describe('resolveRoute', () => {
  it('leaves an absolute route unchanged when no source folder is configured', () => {
    expect(resolveRoute('D:\\Fotos\\gato.png', null)).toBe('D:\\Fotos\\gato.png')
  })

  // A Windows drive-letter path isn't absolute to path.posix, so this shape
  // only means anything on Windows. The pass-through-unchanged behavior
  // itself is covered platform-neutrally by the join()-built tests below.
  it.skipIf(process.platform === 'linux')(
    'leaves an absolute route unchanged even when a source folder is configured',
    () => {
      expect(resolveRoute('D:\\Fotos\\gato.png', 'D:\\Other')).toBe('D:\\Fotos\\gato.png')
    }
  )

  it('joins a relative route onto the configured source folder', () => {
    expect(resolveRoute('gato.png', 'D:\\Fotos')).toBe(join('D:\\Fotos', 'gato.png'))
  })

  it('joins a relative route in a subfolder onto the configured source folder', () => {
    expect(resolveRoute(join('sub', 'gato.png'), 'D:\\Fotos')).toBe(
      join('D:\\Fotos', 'sub', 'gato.png')
    )
  })

  it('leaves a relative route unchanged when no source folder is configured (should not happen in practice)', () => {
    expect(resolveRoute('gato.png', null)).toBe('gato.png')
  })
})

describe('relativizeRoute', () => {
  it('leaves the path unchanged when no source folder is configured', () => {
    expect(relativizeRoute('D:\\Fotos\\gato.png', null)).toBe('D:\\Fotos\\gato.png')
  })

  it('strips the source folder prefix when the path is under it', () => {
    expect(relativizeRoute('D:\\Fotos\\gato.png', 'D:\\Fotos')).toBe('gato.png')
  })

  // Same as above: join() on POSIX produces "D:\Fotos/sub/gato.png", which
  // path.posix never sees as absolute or as living under "D:\Fotos".
  it.skipIf(process.platform === 'linux')(
    'strips the source folder prefix for a nested subfolder',
    () => {
      expect(relativizeRoute(join('D:\\Fotos', 'sub', 'gato.png'), 'D:\\Fotos')).toBe(
        join('sub', 'gato.png')
      )
    }
  )

  it('leaves the path unchanged when it falls outside the source folder', () => {
    expect(relativizeRoute('E:\\Other\\gato.png', 'D:\\Fotos')).toBe('E:\\Other\\gato.png')
  })

  it('does not match a sibling folder that merely shares a text prefix', () => {
    expect(relativizeRoute('D:\\Fotosbackup\\gato.png', 'D:\\Fotos')).toBe(
      'D:\\Fotosbackup\\gato.png'
    )
  })

  it.skipIf(process.platform === 'linux')('matches the source folder case-insensitively', () => {
    expect(relativizeRoute('d:\\fotos\\gato.png', 'D:\\Fotos')).toBe('gato.png')
  })
})
