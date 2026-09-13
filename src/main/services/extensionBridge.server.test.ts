import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { createServer as createNetServer } from 'net'
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
const { readExtensionBridgeSettings, resetExtensionBridgeSettingsCache } = await import(
  './extensionBridgeSettings'
)
const {
  startExtensionBridgeServer,
  stopExtensionBridgeServer,
  isExtensionBridgeRunning,
  getExtensionBridgeStatus,
  setExtensionBridgeEnabled,
  regenerateExtensionBridgeTokenAction
} = await import('./extensionBridge.server')

let cleanup: () => Promise<void>
let sourceDir = ''

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'ext-bridge-server-userdata-'))
  sourceDir = await fs.mkdtemp(join(tmpdir(), 'ext-bridge-server-src-'))
  resetSourceFolderCache()
  resetExtensionBridgeSettingsCache()
  writeSourceFolder(sourceDir)
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await stopExtensionBridgeServer()
  await cleanup()
  await fs.rm(sourceDir, { recursive: true, force: true })
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('extensionBridge.server', () => {
  it('rejects a request with a missing/invalid token', async () => {
    const { port } = await startExtensionBridgeServer({ port: 0 })

    const res = await fetch(`http://127.0.0.1:${port}/lookup?type=tag&query=`, {
      headers: { Authorization: 'Bearer wrong-token' }
    })

    expect(res.status).toBe(401)
  })

  it('creates media from a valid capture request', async () => {
    const { port } = await startExtensionBridgeServer({ port: 0 })
    const { token } = readExtensionBridgeSettings()

    const res = await fetch(`http://127.0.0.1:${port}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileDataBase64: Buffer.from('hello world').toString('base64'),
        fileName: 'post.jpg',
        mediaType: 'image',
        sourceUrl: 'https://example.com/post/1',
        sourceSite: 'danbooru'
      })
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'created', mediaId: expect.any(String) })
  })

  it('responds 409 when no source folder is configured', async () => {
    writeSourceFolder(null)
    const { port } = await startExtensionBridgeServer({ port: 0 })
    const { token } = readExtensionBridgeSettings()

    const res = await fetch(`http://127.0.0.1:${port}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileDataBase64: Buffer.from('x').toString('base64'),
        fileName: 'a.jpg',
        mediaType: 'image',
        sourceUrl: 'https://example.com',
        sourceSite: 'danbooru'
      })
    })

    expect(res.status).toBe(409)
  })

  it('rejects a non-JSON /capture body with 400', async () => {
    const { port } = await startExtensionBridgeServer({ port: 0 })
    const { token } = readExtensionBridgeSettings()

    const res = await fetch(`http://127.0.0.1:${port}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: 'not json'
    })

    expect(res.status).toBe(400)
  })

  it('rejects a capture body that fails validation', async () => {
    const { port } = await startExtensionBridgeServer({ port: 0 })
    const { token } = readExtensionBridgeSettings()

    const res = await fetch(`http://127.0.0.1:${port}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'a.jpg' })
    })

    expect(res.status).toBe(400)
  })

  it('answers /lookup with matches', async () => {
    const { port } = await startExtensionBridgeServer({ port: 0 })
    const { token } = readExtensionBridgeSettings()

    const res = await fetch(`http://127.0.0.1:${port}/lookup?type=tag&query=`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ matches: [] })
  })

  it('setExtensionBridgeEnabled(true) starts the server and persists enabled', async () => {
    const status = await setExtensionBridgeEnabled(true)

    expect(status.enabled).toBe(true)
    expect(status.running).toBe(true)
    expect(isExtensionBridgeRunning()).toBe(true)
  })

  it('setExtensionBridgeEnabled(false) stops the server and persists disabled', async () => {
    await setExtensionBridgeEnabled(true)

    const status = await setExtensionBridgeEnabled(false)

    expect(status.enabled).toBe(false)
    expect(status.running).toBe(false)
    expect(isExtensionBridgeRunning()).toBe(false)
  })

  it('rejects when the port is already in use, without persisting enabled', async () => {
    const blocker = createNetServer()
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', () => resolve()))
    const address = blocker.address()
    const port = typeof address === 'object' && address ? address.port : 0

    try {
      await expect(startExtensionBridgeServer({ port })).rejects.toThrow()
      expect(readExtensionBridgeSettings().enabled).toBe(false)
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()))
    }
  })

  it('regenerateExtensionBridgeTokenAction changes the token in the reported status', async () => {
    const before = getExtensionBridgeStatus()
    const after = regenerateExtensionBridgeTokenAction()

    expect(after.token).not.toBe(before.token)
    expect(after.token).toHaveLength(64)
  })
})
