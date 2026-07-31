import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resolveThumbnail = vi.fn()
const readSauceNaoApiKey = vi.fn()
const fetchDanbooruTags = vi.fn()
const readFile = vi.fn()

vi.mock('../thumbnails/thumbnails', () => ({
  resolveThumbnail: (...args: unknown[]) => resolveThumbnail(...args)
}))
vi.mock('./sauceNaoSettings', () => ({
  readSauceNaoApiKey: (...args: unknown[]) => readSauceNaoApiKey(...args)
}))
vi.mock('./danbooruTags', () => ({
  fetchDanbooruTags: (...args: unknown[]) => fetchDanbooruTags(...args)
}))
vi.mock('fs', () => ({
  promises: { readFile: (...args: unknown[]) => readFile(...args) }
}))

const { lookupSauceNao, clearSauceNaoCache } = await import('./sauceNao.service')

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body))
  } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  resolveThumbnail.mockReset().mockResolvedValue('/cache/thumb.png')
  readFile.mockReset().mockResolvedValue(Buffer.from('fake-png-bytes'))
  readSauceNaoApiKey.mockReset().mockReturnValue(undefined)
  fetchDanbooruTags.mockReset().mockResolvedValue([])
  // The result cache is module-scoped state and would otherwise leak
  // between test cases that all resolve to the same mocked thumbnail path.
  clearSauceNaoCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lookupSauceNao', () => {
  it('resolves the thumbnail and POSTs it to SauceNAO', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        header: { short_remaining: 5, long_remaining: 99 },
        results: [
          {
            header: { similarity: 90, index_name: 'Danbooru' },
            data: { characters: 'Ishtar', material: 'Fate/Grand Order', creator: 'artist' }
          }
        ]
      })
    )

    const result = await lookupSauceNao('/library/pic.png')

    expect(resolveThumbnail).toHaveBeenCalledWith('/library/pic.png')
    expect(fetch).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(calledUrl)).toContain('saucenao.com/search.php')
    expect(String(calledUrl)).toContain('output_type=2')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(FormData)
    expect((init?.body as FormData).get('file')).toBeInstanceOf(Blob)

    expect(result.match?.characters).toEqual([{ name: 'Ishtar' }])
    expect(result.remaining).toEqual({ short: 5, long: 99 })
  })

  it('rejects without calling fetch when no thumbnail can be produced', async () => {
    resolveThumbnail.mockResolvedValue(null)

    await expect(lookupSauceNao('/broken.png')).rejects.toThrow('Could not read that file')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces a friendly message when fetch fails offline', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))

    await expect(lookupSauceNao('/pic.png')).rejects.toThrow('Check your internet connection')
  })

  it('surfaces a friendly message on a timeout', async () => {
    const timeoutError = new Error('The operation was aborted')
    timeoutError.name = 'TimeoutError'
    vi.mocked(fetch).mockRejectedValue(timeoutError)

    await expect(lookupSauceNao('/pic.png')).rejects.toThrow('took too long to respond')
  })

  it('surfaces a rate-limit message on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 429))
    await expect(lookupSauceNao('/pic.png')).rejects.toThrow('rate limit')
  })

  it('surfaces a generic message on HTTP 403 with no parseable body', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 403))
    await expect(lookupSauceNao('/pic.png')).rejects.toThrow('403')
  })

  it("surfaces SauceNAO's own message and a pointer to Settings on HTTP 403 with a body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        {
          header: { status: -1, message: 'The anonymous account type does not permit API usage.' }
        },
        403
      )
    )
    await expect(lookupSauceNao('/pic.png')).rejects.toThrow(
      'The anonymous account type does not permit API usage. Add a free SauceNAO API key in Settings to fix this.'
    )
  })

  it('surfaces a generic message for other error statuses', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500))
    await expect(lookupSauceNao('/pic.png')).rejects.toThrow('500')
  })

  it('surfaces the header message when SauceNAO reports a search-level error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ header: { status: -2, message: 'Image too small.' } })
    )
    await expect(lookupSauceNao('/pic.png')).rejects.toThrow('Image too small.')
  })

  it('surfaces a generic message when the response body is not valid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('bad json'))
    } as unknown as Response)

    await expect(lookupSauceNao('/pic.png')).rejects.toThrow('Unexpected response')
  })

  it('resolves with a null match (not an error) when nothing is above the threshold', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ header: {}, results: [] }))

    const result = await lookupSauceNao('/pic.png')

    expect(result).toEqual({ match: null, remaining: { short: 0, long: 0 } })
  })

  it('rejects a concurrent second call while the first is still running', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    vi.mocked(fetch).mockReturnValue(pendingFetch)

    const first = lookupSauceNao('/a.png')
    await expect(lookupSauceNao('/b.png')).rejects.toThrow('already running')

    resolveFetch(jsonResponse({ header: {}, results: [] }))
    await expect(first).resolves.toEqual({ match: null, remaining: { short: 0, long: 0 } })

    // Settled - a later call should work again.
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ header: {}, results: [] }))
    await expect(lookupSauceNao('/c.png')).resolves.toEqual({
      match: null,
      remaining: { short: 0, long: 0 }
    })
  })

  it('includes the saved API key in the request when one is set', async () => {
    readSauceNaoApiKey.mockReturnValue('my-key')
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ header: {}, results: [] }))

    await lookupSauceNao('/pic.png')

    const [calledUrl] = vi.mocked(fetch).mock.calls[0]
    expect(String(calledUrl)).toContain('api_key=my-key')
  })

  it('omits the api_key param when none is saved', async () => {
    readSauceNaoApiKey.mockReturnValue(undefined)
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ header: {}, results: [] }))

    await lookupSauceNao('/pic.png')

    const [calledUrl] = vi.mocked(fetch).mock.calls[0]
    expect(String(calledUrl)).not.toContain('api_key')
  })

  it('enriches a match with Danbooru tags', async () => {
    fetchDanbooruTags.mockResolvedValue([{ name: '1girl' }, { name: 'blue hair' }])
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        header: {},
        results: [
          {
            header: { similarity: 90, index_name: 'Danbooru' },
            data: {
              characters: 'Ishtar',
              ext_urls: ['https://danbooru.donmai.us/posts/123']
            }
          }
        ]
      })
    )

    const result = await lookupSauceNao('/pic.png')

    expect(fetchDanbooruTags).toHaveBeenCalledWith('https://danbooru.donmai.us/posts/123')
    expect(result.match?.tags).toEqual([{ name: '1girl' }, { name: 'blue hair' }])
  })

  it('does not call the Danbooru enrichment when there is no match', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ header: {}, results: [] }))

    await lookupSauceNao('/pic.png')

    expect(fetchDanbooruTags).not.toHaveBeenCalled()
  })

  it('serves a repeat lookup for the same file from the cache without a new request', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        header: { short_remaining: 5, long_remaining: 90 },
        results: [
          { header: { similarity: 90, index_name: 'Danbooru' }, data: { characters: 'Ishtar' } }
        ]
      })
    )

    const first = await lookupSauceNao('/pic.png')
    const second = await lookupSauceNao('/pic.png')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
  })

  it('caches a "no match" result too, so re-checking the same file is still free', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ header: {}, results: [] }))

    await lookupSauceNao('/pic.png')
    await lookupSauceNao('/pic.png')

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed lookup, so retrying still makes a new request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 500))
    await expect(lookupSauceNao('/pic.png')).rejects.toThrow('500')

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ header: {}, results: [] }))
    await expect(lookupSauceNao('/pic.png')).resolves.toEqual({
      match: null,
      remaining: { short: 0, long: 0 }
    })

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('makes a new request for a different file (different resolved thumbnail path)', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ header: {}, results: [] }))

    resolveThumbnail.mockResolvedValueOnce('/cache/thumb-a.png')
    await lookupSauceNao('/a.png')

    resolveThumbnail.mockResolvedValueOnce('/cache/thumb-b.png')
    await lookupSauceNao('/b.png')

    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
