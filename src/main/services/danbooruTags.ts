import { cleanEntityName } from '@shared/utils'
import type { SauceNaoName } from '@shared/models'
import { DANBOORU_USER_AGENT } from './danbooruHttp'

const DANBOORU_POST_URL = /^https?:\/\/danbooru\.donmai\.us\/posts\/(\d+)/i
const MAX_TAGS = 25
const FETCH_TIMEOUT_MS = 8000

/**
 * Meta/process tags Danbooru attaches that aren't useful as media tags
 * (image quality, moderation workflow, etc.).
 */
const TAG_STOPLIST = new Set([
  'highres',
  'absurdres',
  'lowres',
  'commentary',
  'commentary_request',
  'translated',
  'translation_request',
  'bad_id',
  'bad_pixiv_id',
  'bad_twitter_id',
  'artist_request',
  'character_request',
  'revision',
  'md5_mismatch'
])

/**
 * SauceNAO's booru results carry characters/series/artist but no general
 * tag list - when the winning match is a Danbooru post, this fetches its
 * general tags as a follow-up. Returns [] for any non-Danbooru URL, network
 * failure, timeout, or malformed response; never throws.
 */
export async function fetchDanbooruTags(sourceUrl: string | undefined): Promise<SauceNaoName[]> {
  const match = sourceUrl?.match(DANBOORU_POST_URL)
  if (!match) return []

  try {
    const res = await fetch(`https://danbooru.donmai.us/posts/${match[1]}.json`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': DANBOORU_USER_AGENT }
    })
    if (!res.ok) return []

    const body = (await res.json()) as { tag_string_general?: unknown }
    if (typeof body.tag_string_general !== 'string' || !body.tag_string_general.trim()) return []

    const names: SauceNaoName[] = []
    const seen = new Set<string>()
    for (const rawTag of body.tag_string_general.split(' ')) {
      if (!rawTag || TAG_STOPLIST.has(rawTag.toLowerCase())) continue
      const cleaned = cleanEntityName(rawTag)
      if (!cleaned) continue
      const key = cleaned.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      names.push({ name: cleaned })
      if (names.length >= MAX_TAGS) break
    }
    return names
  } catch {
    return []
  }
}
