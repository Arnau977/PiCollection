import { promises as fs } from 'fs'
import type { SauceNaoLookup } from '@shared/models'
import { resolveThumbnail } from '../../thumbnails/thumbnails'
import { readSauceNaoApiKey } from './sauceNaoSettings'
import { fetchDanbooruTags } from '../danbooruTags'
import { SauceNaoResponseSchema, pickBestMatch } from './sauceNao.parse'
import { logError, logInfo } from '../../logging/logger'

const SEARCH_URL = 'https://saucenao.com/search.php'
const REQUEST_TIMEOUT_MS = 20_000
// SauceNAO's bot protection rejects a custom/identifying User-Agent (observed:
// a "PiCollection (...)" UA got a bare 403) - a realistic browser UA gets through.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/** Cheap double-click/second-window protection - not a queue. */
let inFlight = false

/**
 * Keyed by the resolved thumbnail path rather than the raw file route -
 * `resolveThumbnail`'s own cache key already incorporates the file's mtime
 * and size, so a result naturally invalidates if the underlying file
 * changes, without this cache needing to know anything about that itself.
 * Lives only in memory: cleared by restarting the app, same as the
 * in-flight guard above.
 */
const resultCache = new Map<string, SauceNaoLookup>()

/** Test-only: module-scoped state would otherwise leak between test cases. */
export function clearSauceNaoCache(): void {
  resultCache.clear()
}

function maskApiKey(key: string): string {
  if (key.length <= 6) return '*'.repeat(key.length)
  return `${key.slice(0, 3)}...${key.slice(-3)} (${key.length} chars)`
}

/**
 * Logs the raw response to the terminal running the app, and (when the user
 * has debug logging enabled in Settings) to the persistent debug log too -
 * the fetch happens in the main process, so it never shows up in the
 * renderer's DevTools Network tab, and the terminal is only visible in dev
 * mode. SauceNAO returns an informative `header.message` in the body even
 * on non-2xx statuses (e.g. "The anonymous account type does not permit API
 * usage."), so this returns that when present instead of a generic message.
 */
async function describeSauceNaoErrorResponse(res: Response): Promise<string | null> {
  const relevantHeaders = ['content-type', 'cf-ray', 'cf-mitigated', 'server', 'retry-after']
  const headerSnapshot = Object.fromEntries(
    relevantHeaders
      .map((name) => [name, res.headers.get(name)])
      .filter(([, value]) => value !== null)
  )

  let bodyText = ''
  try {
    bodyText = await res.text()
  } catch {
    bodyText = ''
  }

  console.error(
    '[sauceNao] request rejected',
    JSON.stringify(
      { status: res.status, headers: headerSnapshot, bodySnippet: bodyText.slice(0, 500) },
      null,
      2
    )
  )
  logError('sauceNao', 'Request rejected', {
    status: res.status,
    headers: headerSnapshot,
    bodySnippet: bodyText.slice(0, 500)
  })

  try {
    const parsed = SauceNaoResponseSchema.safeParse(JSON.parse(bodyText))
    return (parsed.success && parsed.data.header?.message) || null
  } catch {
    return null
  }
}

export async function lookupSauceNao(route: string): Promise<SauceNaoLookup> {
  // Reuses the exact thumbnail the gallery already generates/caches, which
  // uniformly handles images, video poster frames, and GIF first frames -
  // no per-type branching needed here.
  const thumbPath = await resolveThumbnail(route)
  if (!thumbPath) {
    throw new Error('Could not read that file to search with.')
  }

  const cached = resultCache.get(thumbPath)
  if (cached) return cached

  if (inFlight) {
    throw new Error('A SauceNAO search is already running.')
  }
  inFlight = true

  try {
    const bytes = await fs.readFile(thumbPath)
    const form = new FormData()
    // `Buffer`'s ArrayBufferLike type isn't assignable to `BlobPart` (it could
    // in theory be backed by a SharedArrayBuffer) - copy into a plain Uint8Array first.
    form.append('file', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), 'thumbnail.png')

    const url = new URL(SEARCH_URL)
    url.searchParams.set('output_type', '2')
    url.searchParams.set('numres', '8')
    url.searchParams.set('db', '999')
    const apiKey = readSauceNaoApiKey()
    if (apiKey) url.searchParams.set('api_key', apiKey)

    const requestMeta = {
      hasApiKey: Boolean(apiKey),
      params: Object.fromEntries(Array.from(url.searchParams).filter(([key]) => key !== 'api_key'))
    }
    console.error(
      '[sauceNao] sending request',
      JSON.stringify({ ...requestMeta, apiKeyPreview: apiKey ? maskApiKey(apiKey) : null }, null, 2)
    )
    logInfo('sauceNao', 'Sending request', requestMeta)

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        body: form,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json, text/plain, */*'
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new Error('SauceNAO took too long to respond. Try again.')
      }
      throw new Error('Could not reach SauceNAO. Check your internet connection.')
    }

    if (res.status === 429) {
      const detail = await describeSauceNaoErrorResponse(res)
      throw new Error(
        detail ?? "SauceNAO's rate limit was reached. Wait about 30 seconds and try again."
      )
    }
    if (res.status === 403) {
      const detail = await describeSauceNaoErrorResponse(res)
      throw new Error(
        detail
          ? `${detail} Add a free SauceNAO API key in Settings to fix this.`
          : 'SauceNAO rejected the request (403). It may be blocking anonymous searches right now.'
      )
    }
    if (!res.ok) {
      const detail = await describeSauceNaoErrorResponse(res)
      throw new Error(detail ?? `SauceNAO returned an error (${res.status}).`)
    }

    let rawBodyText = ''
    let body: unknown
    try {
      rawBodyText = await res.text()
      body = JSON.parse(rawBodyText)
    } catch {
      logError('sauceNao', 'Could not parse SauceNAO response as JSON', {
        status: res.status,
        bodySnippet: rawBodyText.slice(0, 500)
      })
      throw new Error('Unexpected response from SauceNAO.')
    }

    const parsed = SauceNaoResponseSchema.safeParse(body)
    if (!parsed.success) {
      logError('sauceNao', 'SauceNAO response failed schema validation', {
        status: res.status,
        bodySnippet: rawBodyText.slice(0, 500),
        issues: parsed.error.issues.slice(0, 5)
      })
      throw new Error('Unexpected response from SauceNAO.')
    }

    // status < 0 is a search-level error; > 0 is a per-index warning, safe to ignore.
    const status = parsed.data.header?.status
    if (typeof status === 'number' && status < 0) {
      throw new Error(parsed.data.header?.message || 'SauceNAO could not process that image.')
    }

    const lookup = pickBestMatch(parsed.data)
    if (lookup.match) {
      lookup.match.tags = await fetchDanbooruTags(lookup.match.sourceUrl)
    }
    // Only successful lookups are cached - a thrown error above never
    // reaches here, so a failed attempt (rate limit, missing key, etc.)
    // is always retried rather than getting stuck on a cached failure.
    resultCache.set(thumbPath, lookup)
    return lookup
  } finally {
    inFlight = false
  }
}
