import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

const downloadAndVerify = vi.fn()
const extractTarGz = vi.fn()
const spawnMock = vi.fn()

vi.mock('./wd14Runtime.download', () => ({
  downloadAndVerify: (...args: unknown[]) => downloadAndVerify(...args),
  extractTarGz: (...args: unknown[]) => extractTarGz(...args)
}))
vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args)
}))
vi.mock('electron', () => ({ app: { getPath: () => userDataDir } }))

let userDataDir: string

function fakeSpawnSuccess(): { on: (event: string, cb: (code: number) => void) => void } {
  return {
    on: (event: string, cb: (code: number) => void) => {
      if (event === 'close') setTimeout(() => cb(0), 0)
    }
  }
}

const { getWd14RuntimeStatus, installWd14Runtime, removeWd14Runtime } =
  await import('./wd14Runtime.service')

beforeEach(() => {
  userDataDir = mkdtempSync(path.join(tmpdir(), 'wd14-service-test-'))
  downloadAndVerify.mockReset().mockResolvedValue(undefined)
  extractTarGz.mockReset().mockResolvedValue(undefined)
  spawnMock.mockReset().mockReturnValue(fakeSpawnSuccess())
})

afterEach(() => {
  rmSync(userDataDir, { recursive: true, force: true })
})

describe('getWd14RuntimeStatus', () => {
  it('reports not-installed when no runtime.json marker exists', () => {
    expect(getWd14RuntimeStatus()).toEqual({ state: 'not-installed' })
  })

  it('reports installed once the runtime.json marker is present', () => {
    const runtimeDir = path.join(userDataDir, 'wd14-runtime')
    mkdirSync(runtimeDir, { recursive: true })
    writeFileSync(path.join(runtimeDir, 'runtime.json'), '{}')

    expect(getWd14RuntimeStatus()).toEqual({ state: 'installed' })
  })
})

describe('installWd14Runtime', () => {
  it('downloads python, the three wheels, and the model, then installs offline via pip', async () => {
    const events: unknown[] = []
    await installWd14Runtime((e) => events.push(e))

    // python + onnxruntime + numpy + pillow + model + tags = 6 downloads
    expect(downloadAndVerify).toHaveBeenCalledTimes(6)
    expect(extractTarGz).toHaveBeenCalledTimes(1)
    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringContaining('python'),
      expect.arrayContaining(['-m', 'pip', 'install', '--no-index']),
      expect.anything()
    )
    expect(events).toContainEqual({ type: 'installed' })
  })

  it('writes the runtime.json marker only after every step succeeds', async () => {
    await installWd14Runtime(vi.fn())
    expect(getWd14RuntimeStatus()).toEqual({ state: 'installed' })
  })

  it('does not write the marker and surfaces an error event when a download fails', async () => {
    downloadAndVerify.mockRejectedValueOnce(new Error('Checksum mismatch'))

    const events: unknown[] = []
    await expect(installWd14Runtime((e) => events.push(e))).rejects.toThrow('Checksum mismatch')

    expect(events).toContainEqual({ type: 'error', message: 'Checksum mismatch' })
    expect(getWd14RuntimeStatus()).toEqual({ state: 'not-installed' })
  })

  it('rejects when pip install exits non-zero', async () => {
    spawnMock.mockReturnValue({
      on: (event: string, cb: (code: number) => void) => {
        if (event === 'close') setTimeout(() => cb(1), 0)
      }
    })

    await expect(installWd14Runtime(vi.fn())).rejects.toThrow('pip install failed')
  })

  it('emits progress events with increasing percent', async () => {
    const events: { type: string; percent?: number }[] = []
    downloadAndVerify.mockImplementation(
      async (asset: { size: number }, _dest: string, onBytes: (n: number) => void) => {
        onBytes(asset.size)
      }
    )

    await installWd14Runtime((e) => events.push(e as { type: string; percent?: number }))

    const progressEvents = events.filter((e) => e.type === 'progress')
    expect(progressEvents.length).toBeGreaterThan(0)
    expect(progressEvents.at(-1)?.percent).toBe(100)
  })
})

describe('removeWd14Runtime', () => {
  it('deletes the runtime directory', async () => {
    const runtimeDir = path.join(userDataDir, 'wd14-runtime')
    mkdirSync(runtimeDir, { recursive: true })
    writeFileSync(path.join(runtimeDir, 'runtime.json'), '{}')

    await removeWd14Runtime()

    expect(existsSync(runtimeDir)).toBe(false)
    expect(getWd14RuntimeStatus()).toEqual({ state: 'not-installed' })
  })

  it('does not throw when nothing is installed', async () => {
    await expect(removeWd14Runtime()).resolves.toBeUndefined()
  })
})
