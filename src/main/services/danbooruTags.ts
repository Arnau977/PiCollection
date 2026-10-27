import { cleanEntityName } from '@shared/utils'
import type { SauceNaoName } from '@shared/models'
import { danbooruFetch } from './danbooruHttp'
import { readDanbooruCredentials } from './danbooruSettings'

/**
 * A Danbooru post page, in today's form (`/posts/123`) or the old one
 * SauceNAO still links to (`/post/show/123`).
 */
const DANBOORU_POST_URL = /^https?:\/\/danbooru\.donmai\.us\/(?:posts|post\/show)\/(\d+)/i
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

export interface DanbooruPostTags {
  /** General tags, meta ones dropped, capped at MAX_TAGS. */
  tags: SauceNaoName[]
  /** Full character tags, qualifiers kept ("gold ship (run! ruin! launcher!) (umamusume)"). */
  characters: SauceNaoName[]
  /** Copyright tags. */
  series: SauceNaoName[]
}

/** A space-separated tag string as cleaned, case-insensitively unique names. */
function namesFrom(
  tagString: unknown,
  options: { skip?: Set<string>; max?: number } = {}
): SauceNaoName[] {
  if (typeof tagString !== 'string') return []
  const names: SauceNaoName[] = []
  const seen = new Set<string>()
  for (const rawTag of tagString.split(' ')) {
    if (!rawTag || options.skip?.has(rawTag.toLowerCase())) continue
    const cleaned = cleanEntityName(rawTag)
    const key = cleaned.toLowerCase()
    if (!cleaned || seen.has(key)) continue
    seen.add(key)
    names.push({ name: cleaned })
    if (options.max && names.length >= options.max) break
  }
  return names
}

/**
 * When SauceNAO's winning match is a Danbooru post, reads the post itself:
 * its general tags (SauceNAO's results carry none), and its characters and
 * copyrights as they are today - SauceNAO keeps a copy from when it indexed
 * the picture, often before forms like "gold ship (run! ruin! launcher!)"
 * were tagged. Null for any non-Danbooru URL, missing Danbooru credentials
 * (see Settings - unidentified requests are what got this app 403'd by
 * Cloudflare in the first place), network failure, timeout, or malformed
 * response; never throws.
 */
export async function fetchDanbooruPostTags(
  sourceUrl: string | undefined
): Promise<DanbooruPostTags | null> {
  const match = sourceUrl?.match(DANBOORU_POST_URL)
  if (!match) return null
  if (!readDanbooruCredentials()) return null

  try {
    const res = await danbooruFetch(new URL(`https://danbooru.donmai.us/posts/${match[1]}.json`), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
    if (!res.ok) return null

    const body = (await res.json()) as {
      tag_string_general?: unknown
      tag_string_character?: unknown
      tag_string_copyright?: unknown
    }
    return {
      tags: namesFrom(body.tag_string_general, { skip: TAG_STOPLIST, max: MAX_TAGS }),
      characters: namesFrom(body.tag_string_character),
      series: namesFrom(body.tag_string_copyright)
    }
  } catch {
    return null
  }
}
