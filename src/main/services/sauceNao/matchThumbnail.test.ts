import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMatchThumbnail } from './matchThumbnail'

function imageResponse(bytes: number[], type = 'image/jpeg'): Response {
  return {
    ok: true,
    headers: new Headers({ 'Content-Type': type }),
    arrayBuffer: () => Promise.resolve(new Uint8Array(bytes).buffer)
  } as unknown as Response
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchMatchThumbnail', () => {
  it("returns SauceNAO's thumbnail as a data: URL", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(imageResponse([1, 2, 3])))
    expect(await fetchMatchThumbnail('https://img3.saucenao.com/booru/a.jpg')).toBe(
      'data:image/jpeg;base64,AQID'
    )
  })

  it('fetches nothing from any other host, and drops what is not an image', async () => {
    const fetchMock = vi.fn().mockResolvedValue(imageResponse([1], 'text/html'))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchMatchThumbnail('https://evil.example/saucenao.com.jpg')).toBeUndefined()
    expect(await fetchMatchThumbnail('http://img1.saucenao.com/a.jpg')).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await fetchMatchThumbnail('https://saucenao.com/a.jpg')).toBeUndefined()
  })
})
