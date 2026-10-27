import { z } from 'zod'
import type { SauceNaoArtist, SauceNaoLookup, SauceNaoMatch } from '@shared/models'
import { cleanEntityName, splitBooruCharacterList, splitBooruList } from '@shared/utils'

export const MIN_SIMILARITY = 60

/** Lenient schema over SauceNAO's JSON: every field optional, unknown keys ignored. */
export const SauceNaoResponseSchema = z.object({
  header: z
    .object({
      status: z.number().optional(),
      message: z.string().optional(),
      short_remaining: z.number().optional(),
      long_remaining: z.number().optional()
    })
    .optional(),
  results: z
    .array(
      z.object({
        header: z
          .object({
            similarity: z.union([z.string(), z.number()]).optional(),
            index_id: z.number().optional(),
            index_name: z.string().optional(),
            // SauceNAO's own small copy of the matched picture.
            thumbnail: z.string().optional()
          })
          .optional(),
        data: z
          .object({
            ext_urls: z.array(z.string()).optional(),
            title: z.string().optional(),
            eng_name: z.string().optional(),
            jp_name: z.string().optional(),
            characters: z.string().optional(),
            material: z.string().optional(),
            // Some indexes return an array here instead of a comma-joined string.
            creator: z.union([z.string(), z.array(z.string())]).optional(),
            member_name: z.string().optional(),
            author_name: z.string().optional(),
            source: z.string().optional(),
            // Pixiv index: identifies the artist's profile, distinct from
            // `ext_urls` (which points at the specific artwork).
            member_id: z.union([z.string(), z.number()]).optional(),
            // Twitter/X index.
            twitter_user_handle: z.string().optional()
          })
          .optional()
      })
    )
    .optional()
})

export type SauceNaoResponse = z.infer<typeof SauceNaoResponseSchema>

/**
 * The artist's own profile link, derived from index-specific identifiers
 * that exist independently of `ext_urls` (which only ever points at the
 * matched artwork, not the artist's page). Only Pixiv (`member_id`) and
 * Twitter (`twitter_user_handle`) are recognized today.
 */
function deriveArtistSocial(data: {
  member_id?: string | number
  twitter_user_handle?: string
}): Pick<SauceNaoArtist, 'socialUrl' | 'socialLabel'> | undefined {
  if (data.member_id != null) {
    return { socialUrl: `https://www.pixiv.net/en/users/${data.member_id}`, socialLabel: 'Pixiv' }
  }
  if (data.twitter_user_handle) {
    return {
      socialUrl: `https://twitter.com/${data.twitter_user_handle}`,
      socialLabel: 'Twitter'
    }
  }
  return undefined
}

/**
 * "Index #38: H-Misc (E-Hentai) - 1234567-abc.jpg" -> "H-Misc (E-Hentai)":
 * SauceNAO appends the matched thumbnail's file name, which means nothing to
 * the user.
 */
function cleanIndexName(raw: string | undefined): string {
  if (!raw) return 'Unknown source'
  const cleaned = raw
    .replace(/^Index #\d+:\s*/i, '')
    .replace(/\s+-\s+\S+\.(?:jpe?g|png|gif|webp|bmp)$/i, '')
    .trim()
  return cleaned || 'Unknown source'
}

const HTTP_URL = /^https?:\/\/\S+$/i

/**
 * Gallery indexes whose results carry no `ext_urls`, by SauceNAO index id:
 * the best that can be offered is a search on the site for the gallery title.
 */
const GALLERY_SEARCH: Record<number, { site: string; url: (query: string) => string }> = {
  18: { site: 'nhentai', url: (q) => `https://nhentai.net/search/?q=${encodeURIComponent(q)}` },
  38: { site: 'E-Hentai', url: (q) => `https://e-hentai.org/?f_search=${encodeURIComponent(q)}` }
}

function gallerySearch(
  indexId: number | undefined,
  data: { eng_name?: string; jp_name?: string; source?: string }
): SauceNaoMatch['search'] {
  const target = indexId === undefined ? undefined : GALLERY_SEARCH[indexId]
  const title = [data.eng_name, data.jp_name, data.source].find(
    (value) => value?.trim() && !HTTP_URL.test(value.trim())
  )
  return target && title ? { site: target.site, url: target.url(title.trim()) } : undefined
}

/**
 * Picks the best usable result: highest similarity above the threshold that
 * actually carries booru metadata (characters/material/creator). The raw
 * top hit is frequently a Pixiv/Twitter entry with none of that, sitting
 * above a slightly-lower-similarity Danbooru hit that has everything -
 * preferring metadata over raw similarity gives far more useful suggestions.
 */
export function pickBestMatch(
  parsed: SauceNaoResponse,
  minSimilarity: number = MIN_SIMILARITY
): SauceNaoLookup & { thumbnailUrl?: string } {
  const remaining = {
    short: parsed.header?.short_remaining ?? 0,
    long: parsed.header?.long_remaining ?? 0
  }

  const candidates = (parsed.results ?? [])
    .map((result) => ({
      similarity: Number.parseFloat(String(result.header?.similarity ?? '')) || 0,
      indexName: cleanIndexName(result.header?.index_name),
      indexId: result.header?.index_id,
      thumbnailUrl: result.header?.thumbnail,
      data: result.data ?? {}
    }))
    .filter((candidate) => candidate.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)

  if (candidates.length === 0) return { match: null, remaining }

  const withMetadata = candidates.find(
    (candidate) => candidate.data.characters || candidate.data.material || candidate.data.creator
  )
  const chosen = withMetadata ?? candidates[0]

  // Full tags, qualifiers included: the renderer decides which are series and which forms.
  const characters = splitBooruCharacterList(chosen.data.characters)
  const series = splitBooruList(chosen.data.material)

  const artistNames = splitBooruList(chosen.data.creator)
  const social = deriveArtistSocial(chosen.data)
  // Social links only ever attach to a Pixiv/Twitter member/author name - a
  // booru `creator` tag is a separate community tag that may not actually be
  // the same person as `member_id`/`twitter_user_handle` on this result.
  const artist: SauceNaoArtist | null =
    artistNames[0] ??
    (chosen.data.member_name
      ? { name: cleanEntityName(chosen.data.member_name), ...social }
      : null) ??
    (chosen.data.author_name ? { name: cleanEntityName(chosen.data.author_name), ...social } : null)

  // Some indexes leave `ext_urls` out but put the original post's URL in `source`.
  const rawSource = chosen.data.source?.trim()
  const sourceUrl =
    chosen.data.ext_urls?.[0] ?? (rawSource && HTTP_URL.test(rawSource) ? rawSource : undefined)

  const match: SauceNaoMatch = {
    similarity: chosen.similarity,
    indexName: chosen.indexName,
    sourceUrl,
    title: chosen.data.title ?? chosen.data.eng_name,
    search: sourceUrl ? undefined : gallerySearch(chosen.indexId, chosen.data),
    artist,
    characters,
    series,
    tags: []
  }

  // Fetched by the service (fetchMatchThumbnail), not part of the match itself.
  return { match, remaining, thumbnailUrl: chosen.thumbnailUrl }
}
