import type { DanbooruTagSuggestion } from '@shared/models'
import { danbooruFetch } from './danbooruHttp'
import { readDanbooruCredentials } from './danbooruSettings'

const REQUEST_TIMEOUT_MS = 5000
const GENERAL_CATEGORY = 0

interface RawSuggestion {
  value?: unknown
  category?: unknown
  post_count?: unknown
}

/**
 * Best-effort Danbooru tag-name suggestions for the tag-creation form.
 * Requires a configured Danbooru account (see Settings) - unidentified
 * requests are what got this app 403'd by Cloudflare in the first place, so
 * this returns [] rather than ever falling back to an anonymous request.
 * Never throws - a failure here should never block creating a tag, it
 * should just mean no suggestions, same convention as `danbooruTags.ts`.
 */
export async function autocompleteDanbooruTags(query: string): Promise<DanbooruTagSuggestion[]> {
  if (!readDanbooruCredentials()) return []

  const url = new URL('https://danbooru.donmai.us/autocomplete.json')
  url.searchParams.set('search[query]', query)
  url.searchParams.set('search[type]', 'tag_query')
  url.searchParams.set('limit', '10')

  try {
    const res = await danbooruFetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (!res.ok) return []

    const body = await res.json()
    if (!Array.isArray(body)) return []

    return (body as RawSuggestion[])
      .filter((entry) => entry.category === GENERAL_CATEGORY && typeof entry.value === 'string')
      .map((entry) => ({
        name: entry.value as string,
        postCount: typeof entry.post_count === 'number' ? entry.post_count : 0
      }))
  } catch {
    return []
  }
}
