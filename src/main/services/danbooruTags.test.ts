import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir, getVersion: () => '1.0.0' }
}))

const { fetchDanbooruPostTags } = await import('./danbooruTags')
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

describe('fetchDanbooruPostTags', () => {
  it('returns null without calling fetch for a non-Danbooru or missing URL', async () => {
    expect(await fetchDanbooruPostTags('https://gelbooru.com/index.php?page=post&id=1')).toBeNull()
    expect(await fetchDanbooruPostTags(undefined)).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null without calling fetch when no Danbooru credentials are configured', async () => {
    resetDanbooruCredentialsCache()
    writeDanbooruCredentials(undefined)

    expect(await fetchDanbooruPostTags('https://danbooru.donmai.us/posts/12345')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("reads the post's general tags, characters (qualifiers kept) and copyrights", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        tag_string_general: '1girl blue_hair',
        tag_string_character: 'gold_ship_(run!_ruin!_launcher!)_(umamusume) gold_ship_(umamusume)',
        tag_string_copyright: 'umamusume'
      })
    )

    const post = await fetchDanbooruPostTags('https://danbooru.donmai.us/posts/12345')

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'https://danbooru.donmai.us/posts/12345.json' }),
      expect.objectContaining({ signal: expect.anything() })
    )
    expect(post).toEqual({
      tags: [{ name: '1girl' }, { name: 'blue hair' }],
      characters: [
        { name: 'gold ship (run! ruin! launcher!) (umamusume)' },
        { name: 'gold ship (umamusume)' }
      ],
      series: [{ name: 'umamusume' }]
    })
  })

  // SauceNAO links Danbooru matches this way.
  it('understands the old /post/show/ URL', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ tag_string_general: '1girl' }))

    await fetchDanbooruPostTags('https://danbooru.donmai.us/post/show/10120179')

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'https://danbooru.donmai.us/posts/10120179.json' }),
      expect.anything()
    )
  })

  it('drops stoplisted meta tags and caps the general tags', async () => {
    const manyTags = Array.from({ length: 40 }, (_, i) => `tag_${i}`).join(' ')
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ tag_string_general: `highres commentary_request ${manyTags}` })
    )

    const post = await fetchDanbooruPostTags('https://danbooru.donmai.us/posts/1')

    expect(post?.tags[0]).toEqual({ name: 'tag 0' })
    expect(post?.tags).toHaveLength(25)
  })

  it('returns null and never throws on a bad response, a network failure or invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, false))
    expect(await fetchDanbooruPostTags('https://danbooru.donmai.us/posts/1')).toBeNull()

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'))
    expect(await fetchDanbooruPostTags('https://danbooru.donmai.us/posts/1')).toBeNull()

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('bad json'))
    } as unknown as Response)
    expect(await fetchDanbooruPostTags('https://danbooru.donmai.us/posts/1')).toBeNull()
  })
})
