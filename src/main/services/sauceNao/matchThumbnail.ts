const FETCH_TIMEOUT_MS = 8000
/** SauceNAO's thumbnails are a few KB; anything far bigger isn't one. */
const MAX_BYTES = 512 * 1024

/** Only SauceNAO's own image hosts (saucenao.com, img1.saucenao.com...). */
function isSauceNaoImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'saucenao.com' || url.hostname.endsWith('.saucenao.com'))
    )
  } catch {
    return false
  }
}

/**
 * Downloads SauceNAO's thumbnail of the matched picture as a `data:` URL, so
 * the edit form can show it next to the user's own before the match is
 * trusted. Only from SauceNAO's hosts, only an image, size and time capped;
 * undefined on anything else - the match still works without it.
 */
export async function fetchMatchThumbnail(raw: string | undefined): Promise<string | undefined> {
  if (!raw || !isSauceNaoImageUrl(raw)) return undefined
  try {
    const res = await fetch(raw, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    const type = res.headers.get('Content-Type')?.split(';')[0].trim() ?? ''
    if (!res.ok || !type.startsWith('image/')) return undefined
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return undefined
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return undefined
  }
}
