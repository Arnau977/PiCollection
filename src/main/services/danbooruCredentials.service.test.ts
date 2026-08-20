import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir, getVersion: () => '1.0.0' }
}))

const { resolveDanbooruUserId } = await import('./danbooruCredentials.service')
const { resetDanbooruRateLimiterForTests } = await import('./danbooruHttp')

const originalFetch = global.fetch

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'danbooru-credentials-'))
  resetDanbooruRateLimiterForTests()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
  vi.unstubAllGlobals()
  global.fetch = originalFetch
})

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as Response
}

describe('resolveDanbooruUserId', () => {
  it('resolves the numeric user id for valid credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: 42, name: 'arnau' }))

    const id = await resolveDanbooruUserId('arnau', 'abc123')

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'https://danbooru.donmai.us/profile.json?login=arnau&api_key=abc123'
      }),
      expect.objectContaining({ signal: expect.anything() })
    )
    expect(id).toBe(42)
  })

  it('throws a friendly error when Danbooru rejects the credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false))

    await expect(resolveDanbooruUserId('arnau', 'wrong-key')).rejects.toThrow(
      'Danbooru rejected that username/API key.'
    )
  })

  it('throws a friendly error when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))

    await expect(resolveDanbooruUserId('arnau', 'abc123')).rejects.toThrow(
      'Could not reach Danbooru. Check your internet connection.'
    )
  })
})
