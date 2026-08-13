import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'

vi.stubGlobal('fetch', vi.fn())

const { lookupTagWiki } = await import('./tagWiki.service')

let cleanup: () => Promise<void>

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body))
  } as Response
}

beforeEach(async () => {
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
  vi.mocked(fetch).mockReset()
})

afterEach(async () => {
  await cleanup()
})

describe('lookupTagWiki', () => {
  it('fetches from Danbooru and persists the result on a cache miss', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([
        { title: 'cat_ears', body: 'A character with cat ears.', other_names: ['nekomimi'] }
      ])
    )

    const result = await lookupTagWiki('cat_ears')

    expect(result).toEqual({
      tagName: 'cat_ears',
      body: 'A character with cat ears.',
      otherNames: ['nekomimi']
    })
    const [calledUrl] = vi.mocked(fetch).mock.calls[0]
    expect(String(calledUrl)).toContain('wiki_pages.json')
    expect(String(calledUrl)).toContain('search%5Btitle%5D=cat_ears')
  })

  it('serves a repeat lookup from the cache without a new request', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([{ title: 'cat_ears', body: 'A character with cat ears.', other_names: [] }])
    )

    await lookupTagWiki('cat_ears')
    await lookupTagWiki('cat_ears')

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('is case-insensitive on the cache key', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([{ title: 'cat_ears', body: 'A character with cat ears.', other_names: [] }])
    )

    await lookupTagWiki('Cat_Ears')
    await lookupTagWiki('cat_ears')

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('returns null, uncached, when Danbooru has no wiki page for that name', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]))

    const first = await lookupTagWiki('not_a_real_tag')
    expect(first).toBeNull()

    const second = await lookupTagWiki('not_a_real_tag')
    expect(second).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('surfaces a friendly message when fetch fails offline', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))
    await expect(lookupTagWiki('cat_ears')).rejects.toThrow('Check your internet connection')
  })

  it('surfaces a friendly message on a timeout', async () => {
    const timeoutError = new Error('The operation was aborted')
    timeoutError.name = 'TimeoutError'
    vi.mocked(fetch).mockRejectedValue(timeoutError)
    await expect(lookupTagWiki('cat_ears')).rejects.toThrow('took too long to respond')
  })

  it('surfaces a friendly message on a non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500))
    await expect(lookupTagWiki('cat_ears')).rejects.toThrow('Danbooru returned an error (500)')
  })

  it('surfaces a friendly message when the response body is not valid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<html>not json</html>')
    } as unknown as Response)
    await expect(lookupTagWiki('cat_ears')).rejects.toThrow('Unexpected response')
  })
})
