import { app } from 'electron'
import { readDanbooruCredentials } from './danbooruSettings'
import { createRateLimiter } from './rateLimiter'

const PROJECT_URL = 'https://github.com/Arnau977/PiCollection'

// Danbooru's own API docs: "try to stay at around 1 request per second to
// avoid slowing down the site for other users" for sustained use (10/s is
// only the hard burst ceiling, not a target). Every Danbooru request in the
// app - autocomplete, tag-wiki lookups, SauceNAO's Danbooru follow-up, and
// credential validation - goes through this one limiter, so no combination
// of features can add up to more than ~1 req/s app-wide.
const RATE_LIMIT_MS = 1100
let rateLimit = createRateLimiter(RATE_LIMIT_MS)

/**
 * Test-only: the limiter above is module-scoped state shared by every test
 * in a file, so back-to-back tests each making a Danbooru call would
 * otherwise queue behind real ~1.1s waits. Call this in beforeEach.
 */
export function resetDanbooruRateLimiterForTests(): void {
  rateLimit = createRateLimiter(RATE_LIMIT_MS)
}

/**
 * Danbooru's Cloudflare bot-protection now specifically requires the
 * User-Agent to contain "user #<id>" for a real Danbooru account (see
 * DANBOORU_USER_AGENT's old single-string version and its own comment history
 * - a plain custom string alone stopped being enough once Cloudflare's rules
 * tightened). With credentials configured in Settings this authenticates as
 * that account (HTTP Basic) and identifies it in the UA; without them it
 * falls back to an honest, anonymous UA that may still occasionally be
 * challenged. Shared by every Danbooru request in the app: fetchDanbooruTags,
 * autocompleteDanbooruTags, lookupTagWiki, resolveDanbooruUserId.
 */
export function danbooruRequestHeaders(): HeadersInit {
  const version = app.getVersion()
  const credentials = readDanbooruCredentials()

  if (!credentials) {
    return { 'User-Agent': `PiCollection/${version} (+${PROJECT_URL})` }
  }

  const basicAuth = Buffer.from(`${credentials.username}:${credentials.apiKey}`).toString('base64')
  return {
    'User-Agent': `PiCollection/${version} (user #${credentials.userId})`,
    Authorization: `Basic ${basicAuth}`
  }
}

/** Rate-limited fetch wrapper - every Danbooru request should go through this, not raw fetch(). */
export function danbooruFetch(url: URL, init: RequestInit): Promise<Response> {
  return rateLimit(() => fetch(url, { ...init, headers: danbooruRequestHeaders() }))
}
