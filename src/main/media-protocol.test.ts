import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''
let protocolHandler: ((request: Request) => Promise<Response>) | null = null

// media-protocol.ts statically imports thumbnails.ts, which imports
// electron's nativeImage - stubbed the same way media.service.duplicate.test.ts
// does. protocol.handle just captures the handler for this test to call
// directly, mirroring how Electron itself would invoke it per-request.
vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
  nativeImage: {
    createThumbnailFromPath: () => Promise.reject(new Error('unavailable in tests')),
    createFromPath: () => ({ isEmpty: () => true }),
    createFromBitmap: () => ({ isEmpty: () => true }),
    createFromBuffer: () => ({ isEmpty: () => true })
  },
  protocol: {
    registerSchemesAsPrivileged: () => {},
    handle: (_scheme: string, handler: (request: Request) => Promise<Response>) => {
      protocolHandler = handler
    }
  }
}))

const { registerMediaProtocolHandler } = await import('./media-protocol')
const { writeSourceFolder, resetSourceFolderCache } = await import('./services/sourceFolder')

let sourceDir = ''

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'media-protocol-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'media-protocol-src-'))
  // readSourceFolder is module-scope cached, so a value written by an earlier
  // test would otherwise leak into this test's fresh userData dir.
  resetSourceFolderCache()
  registerMediaProtocolHandler()
})

afterEach(async () => {
  await fs.rm(userDataDir, { recursive: true, force: true })
  await fs.rm(sourceDir, { recursive: true, force: true })
})

function mediaRequestFor(route: string): Request {
  const encoded = encodeURI(route.replace(/\\/g, '/'))
  return new Request(`app://media/${encoded}`)
}

describe('media protocol source folder resolution', () => {
  it('serves an absolute route unchanged with no source folder configured', async () => {
    const file = join(sourceDir, 'a.png')
    await fs.writeFile(file, 'hello')

    const response = await protocolHandler!(mediaRequestFor(file))

    expect(response.status).toBe(200)
    await response.arrayBuffer()
  })

  it('404s an absolute route pointing at a file that does not exist', async () => {
    const response = await protocolHandler!(mediaRequestFor(join(sourceDir, 'missing.png')))

    expect(response.status).toBe(404)
  })

  it('resolves a bare relative route against the configured source folder', async () => {
    writeSourceFolder(sourceDir)
    await fs.writeFile(join(sourceDir, 'a.png'), 'hello')

    const response = await protocolHandler!(mediaRequestFor('a.png'))

    expect(response.status).toBe(200)
    await response.arrayBuffer()
  })

  it('resolves a relative route in a subfolder against the configured source folder', async () => {
    writeSourceFolder(sourceDir)
    await fs.mkdir(join(sourceDir, 'sub'), { recursive: true })
    await fs.writeFile(join(sourceDir, 'sub', 'a.png'), 'hello')

    const response = await protocolHandler!(mediaRequestFor(join('sub', 'a.png')))

    expect(response.status).toBe(200)
    await response.arrayBuffer()
  })

  it('404s a relative route when no source folder is configured (nothing to resolve against)', async () => {
    const response = await protocolHandler!(mediaRequestFor('a.png'))

    expect(response.status).toBe(404)
  })

  it('serves the thumb host too, falling back to the original file for an image with no cached thumbnail', async () => {
    writeSourceFolder(sourceDir)
    await fs.writeFile(join(sourceDir, 'a.png'), 'hello')

    const response = await protocolHandler!(
      new Request(`app://thumb/${encodeURI('a.png')}`)
    )

    expect(response.status).toBe(200)
    await response.arrayBuffer()
  })
})
