import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'crypto'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { downloadAndVerify } from './wd14Runtime.download'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'wd14-download-test-'))
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

function streamResponse(chunks: Buffer[], ok = true, status = 200): Response {
  let i = 0
  return {
    ok,
    status,
    body: {
      getReader: () => ({
        read: async () => {
          if (i < chunks.length) {
            return { done: false, value: new Uint8Array(chunks[i++]) }
          }
          return { done: true, value: undefined }
        }
      })
    }
  } as unknown as Response
}

describe('downloadAndVerify', () => {
  it('writes the file and resolves when the hash matches', async () => {
    const content = Buffer.from('hello world')
    const sha256 = createHash('sha256').update(content).digest('hex')
    vi.mocked(fetch).mockResolvedValue(streamResponse([content]))

    const dest = path.join(dir, 'out.bin')
    const onBytes = vi.fn()
    await downloadAndVerify(
      { url: 'https://example.com/f', sha256, size: content.length },
      dest,
      onBytes
    )

    expect(readFileSync(dest)).toEqual(content)
    expect(onBytes).toHaveBeenCalledWith(content.length)
  })

  it('reports cumulative bytes across multiple chunks', async () => {
    const chunkA = Buffer.from('abc')
    const chunkB = Buffer.from('defgh')
    const sha256 = createHash('sha256')
      .update(Buffer.concat([chunkA, chunkB]))
      .digest('hex')
    vi.mocked(fetch).mockResolvedValue(streamResponse([chunkA, chunkB]))

    const onBytes = vi.fn()
    await downloadAndVerify(
      { url: 'https://example.com/f', sha256, size: 8 },
      path.join(dir, 'out.bin'),
      onBytes
    )

    expect(onBytes).toHaveBeenNthCalledWith(1, 3)
    expect(onBytes).toHaveBeenNthCalledWith(2, 8)
  })

  it('deletes the file and rejects on a checksum mismatch', async () => {
    vi.mocked(fetch).mockResolvedValue(streamResponse([Buffer.from('wrong content')]))
    const dest = path.join(dir, 'out.bin')

    await expect(
      downloadAndVerify(
        { url: 'https://example.com/f', sha256: 'a'.repeat(64), size: 13 },
        dest,
        vi.fn()
      )
    ).rejects.toThrow('Checksum mismatch')

    expect(() => readFileSync(dest)).toThrow()
  })

  it('rejects on a non-2xx response without writing a file', async () => {
    vi.mocked(fetch).mockResolvedValue(streamResponse([], false, 404))
    const dest = path.join(dir, 'out.bin')

    await expect(
      downloadAndVerify(
        { url: 'https://example.com/f', sha256: 'a'.repeat(64), size: 1 },
        dest,
        vi.fn()
      )
    ).rejects.toThrow('404')

    expect(() => readFileSync(dest)).toThrow()
  })
})
