import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir, getVersion: () => '1.0.0' }
}))

const { fetchDanbooruTags } = await import('./danbooruTags')
const { writeDanbooruCredentials, resetDanbooruCredentialsCache } = await import(
  './danbooruSettings'
)
const { resetDanbooruRateLimiterForTests } = await import('./danbooruHttp')

const originalFetch = global.fetch

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'danbooru-tags-'))
  resetDanbooruCredentialsCache()
  writeDanbooruCredentials({ username: 'arnau', apiKey: 'abc123', userId: 42 })
  resetDanbooruRateLimiterForTests()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
  vi.unstubAllGlobals()
  global.fetch = originalFetch
})

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body)
  } as Response
}

describe('fetchDanbooruTags', () => {
  it('returns an empty array for a non-Danbooru URL', async () => {
    expect(await fetchDanbooruTags('https://gelbooru.com/index.php?page=post&id=1')).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns an empty array for an undefined URL', async () => {
    expect(await fetchDanbooruTags(undefined)).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns an empty array without calling fetch when no Danbooru credentials are configured', async () => {
    resetDanbooruCredentialsCache()
    writeDanbooruCredentials(undefined)

    expect(await fetchDanbooruTags('https://danbooru.donmai.us/posts/12345')).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches the post JSON and returns its cleaned general tags', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ tag_string_general: 'hatsune_miku 1girl blue_hair' })
    )

    const tags = await fetchDanbooruTags('https://danbooru.donmai.us/posts/12345')

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'https://danbooru.donmai.us/posts/12345.json' }),
      expect.objectContaining({ signal: expect.anything() })
    )
    expect(tags).toEqual([{ name: 'hatsune miku' }, { name: '1girl' }, { name: 'blue hair' }])
  })

  it('removes stoplisted meta tags', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ tag_string_general: '1girl highres commentary_request blue_hair' })
    )

    const tags = await fetchDanbooruTags('https://danbooru.donmai.us/posts/1')

    expect(tags).toEqual([{ name: '1girl' }, { name: 'blue hair' }])
  })

  it('caps the number of returned tags', async () => {
    const manyTags = Array.from({ length: 40 }, (_, i) => `tag_${i}`).join(' ')
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ tag_string_general: manyTags }))

    const tags = await fetchDanbooruTags('https://danbooru.donmai.us/posts/1')

    expect(tags).toHaveLength(25)
  })

  it('returns an empty array when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false))
    expect(await fetchDanbooruTags('https://danbooru.donmai.us/posts/1')).toEqual([])
  })

  it('returns an empty array when tag_string_general is missing', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}))
    expect(await fetchDanbooruTags('https://danbooru.donmai.us/posts/1')).toEqual([])
  })

  it('returns an empty array and never throws on a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))
    expect(await fetchDanbooruTags('https://danbooru.donmai.us/posts/1')).toEqual([])
  })

  it('returns an empty array and never throws when the body is not valid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('bad json'))
    } as unknown as Response)
    expect(await fetchDanbooruTags('https://danbooru.donmai.us/posts/1')).toEqual([])
  })
})
