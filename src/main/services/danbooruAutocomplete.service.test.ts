import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { autocompleteDanbooruTags } from './danbooruAutocomplete.service'

const originalFetch = global.fetch

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  global.fetch = originalFetch
})

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as Response
}

describe('autocompleteDanbooruTags', () => {
  it('queries the autocomplete endpoint with the given text', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    await autocompleteDanbooruTags('cat')

    const [calledUrl] = vi.mocked(fetch).mock.calls[0]
    expect(String(calledUrl)).toContain('autocomplete.json')
    expect(String(calledUrl)).toContain('search%5Bquery%5D=cat')
    expect(String(calledUrl)).toContain('search%5Btype%5D=tag_query')
  })

  it('returns only category-0 (General) results, mapped to name/postCount', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([
        { value: 'cat_ears', category: 0, post_count: 50000 },
        { value: 'hatsune_miku', category: 4, post_count: 900000 },
        { value: 'cat_ears_(cosplay)', category: 0, post_count: 20 }
      ])
    )

    const result = await autocompleteDanbooruTags('cat')

    expect(result).toEqual([
      { name: 'cat_ears', postCount: 50000 },
      { name: 'cat_ears_(cosplay)', postCount: 20 }
    ])
  })

  it('returns an empty array when the response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false))
    expect(await autocompleteDanbooruTags('cat')).toEqual([])
  })

  it('returns an empty array when the response is not an array', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'nope' }))
    expect(await autocompleteDanbooruTags('cat')).toEqual([])
  })

  it('returns an empty array and never throws on a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))
    expect(await autocompleteDanbooruTags('cat')).toEqual([])
  })

  it('returns an empty array and never throws when the body is not valid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('bad json'))
    } as unknown as Response)
    expect(await autocompleteDanbooruTags('cat')).toEqual([])
  })
})
