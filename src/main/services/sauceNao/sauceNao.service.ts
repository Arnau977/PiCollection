import { promises as fs } from 'fs'
import type { SauceNaoLookup, SauceNaoQuota } from '@shared/models'
import { resolveThumbnail } from '../../thumbnails/thumbnails'
import { AppError } from '../../errors'
import { readSauceNaoApiKey } from './sauceNaoSettings'
import { fetchDanbooruTags } from '../danbooruTags'
import { SauceNaoResponseSchema, pickBestMatch } from './sauceNao.parse'
import { logError, logInfo } from '../../logging/logger'
import { createRateLimiter } from '../rateLimiter'

const SEARCH_URL = 'https://saucenao.com/search.php'
const REQUEST_TIMEOUT_MS = 20_000
// SauceNAO's exact published quota varies by source/account tier (free
// accounts have been documented anywhere from 4-8 requests/30s); rather than
// trust a possibly-stale number, this enforces a conservative floor well
// under any of them - see danbooruHttp.ts's own limiter for the same idea
// applied to Danbooru's (better-documented) 1 req/s guidance.
const rateLimit = createRateLimiter(3000)
// SauceNAO's bot protection rejects a custom/identifying User-Agent (observed:
// a "PiCollection (...)" UA got a bare 403) - a realistic browser UA gets through.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// SauceNAO's daily quota is a rolling 24h window, so searches free up again
// gradually and there's no exact reset time to wait for. Pausing for an hour
// stops the button from sending searches that are sure to fail, without
// locking it for a whole day; a rejected search doesn't use up quota, so
// trying again after the pause costs nothing.
const DAILY_LIMIT_PAUSE_MS = 60 * 60 * 1000
export const DAILY_LIMIT_ERROR_CODE = 'SAUCE_NAO_DAILY_LIMIT'
const DAILY_LIMIT_MESSAGE = "SauceNAO's daily search limit was reached."

/** In memory only: after a restart, the first rejected search sets it again. */
let exhaustedUntil: number | null = null

export function getSauceNaoQuota(): SauceNaoQuota {
  if (exhaustedUntil !== null && exhaustedUntil <= Date.now()) exhaustedUntil = null
  return { exhaustedUntil }
}

function markDailyLimitReached(): void {
  exhaustedUntil = Date.now() + DAILY_LIMIT_PAUSE_MS
}

/** SauceNAO's `header.message` is HTML meant for its website (`<strong>`, `<br />`, links). */
function toPlainText(message: string): string {
  return message
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

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
  exhaustedUntil = null
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
    const message = parsed.success ? parsed.data.header?.message : undefined
    return message ? toPlainText(message) || null : null
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
    throw new AppError('NO_THUMBNAIL', 'Could not read that file to search with.')
  }

  const cached = resultCache.get(thumbPath)
  if (cached) return cached

  if (getSauceNaoQuota().exhaustedUntil !== null) {
    throw new AppError(DAILY_LIMIT_ERROR_CODE, DAILY_LIMIT_MESSAGE)
  }

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
      res = await rateLimit(() =>
        fetch(url, {
          method: 'POST',
          body: form,
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json, text/plain, */*'
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        })
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new Error('SauceNAO took too long to respond. Try again.')
      }
      throw new Error('Could not reach SauceNAO. Check your internet connection.')
    }

    if (res.status === 429) {
      // Two different limits share this status: the per-30s one ("Search
      // Rate Too High.") and the daily one ("Daily Search Limit Exceeded.").
      const detail = await describeSauceNaoErrorResponse(res)
      if (detail && /daily/i.test(detail)) {
        markDailyLimitReached()
        throw new AppError(DAILY_LIMIT_ERROR_CODE, DAILY_LIMIT_MESSAGE)
      }
      throw new Error("SauceNAO's rate limit was reached. Wait about 30 seconds and try again.")
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
      const message = toPlainText(parsed.data.header?.message ?? '')
      throw new Error(message || 'SauceNAO could not process that image.')
    }

    const lookup = pickBestMatch(parsed.data)
    // That search was the last one of the window - don't wait for a rejection.
    if (parsed.data.header?.long_remaining === 0) markDailyLimitReached()
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
