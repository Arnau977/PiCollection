import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
    getVersion: () => '1.3.0'
  }
}))

const { danbooruRequestHeaders, danbooruFetch } = await import('./danbooruHttp')
const { writeDanbooruCredentials, resetDanbooruCredentialsCache } = await import(
  './danbooruSettings'
)

const originalFetch = global.fetch

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'danbooru-http-'))
  resetDanbooruCredentialsCache()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
  vi.unstubAllGlobals()
  global.fetch = originalFetch
})

describe('danbooruRequestHeaders', () => {
  it('falls back to an anonymous, honest User-Agent when no credentials are configured', () => {
    expect(danbooruRequestHeaders()).toEqual({
      'User-Agent': 'PiCollection/1.3.0 (+https://github.com/Arnau977/PiCollection)'
    })
  })

  it('identifies as the configured user and sends Basic auth once credentials are saved', () => {
    writeDanbooruCredentials({ username: 'arnau', apiKey: 'abc123', userId: 42 })

    expect(danbooruRequestHeaders()).toEqual({
      'User-Agent': 'PiCollection/1.3.0 (user #42)',
      Authorization: `Basic ${Buffer.from('arnau:abc123').toString('base64')}`
    })
  })
})

describe('danbooruFetch', () => {
  it('calls fetch with the given init plus the current Danbooru headers', async () => {
    writeDanbooruCredentials({ username: 'arnau', apiKey: 'abc123', userId: 42 })
    const url = new URL('https://danbooru.donmai.us/wiki_pages.json')

    await danbooruFetch(url, { signal: AbortSignal.timeout(1000) })

    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        signal: expect.anything(),
        headers: {
          'User-Agent': 'PiCollection/1.3.0 (user #42)',
          Authorization: `Basic ${Buffer.from('arnau:abc123').toString('base64')}`
        }
      })
    )
  })
})
