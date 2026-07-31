import { z } from 'zod'
import type { SauceNaoArtist, SauceNaoLookup, SauceNaoMatch, SauceNaoName } from '@shared/models'

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
            index_name: z.string().optional()
          })
          .optional(),
        data: z
          .object({
            ext_urls: z.array(z.string()).optional(),
            title: z.string().optional(),
            eng_name: z.string().optional(),
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

/** Underscores to spaces, whitespace collapsed. Deliberately no case changes - title-casing would mangle names like "McDonald" or "xxNightmarexx". */
export function cleanEntityName(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

interface SplitResult {
  names: SauceNaoName[]
  /** Trailing "(qualifier)" groups stripped off each name, e.g. "Fate" from "Ishtar (Fate)". */
  qualifiers: SauceNaoName[]
}

const TRAILING_QUALIFIER = /^(.*?)\s*\(([^()]*)\)\s*$/

/**
 * Splits a booru-style comma-separated list ("Ishtar (Fate), Ereshkigal (Fate)")
 * into cleaned names, peeling off trailing parenthetical qualifiers into a
 * separate bucket. Only ever splits on commas - a "/" inside a name (e.g.
 * "Fate/Grand Order") must survive intact.
 */
function splitBooruListWithQualifiers(raw: string | string[] | undefined): SplitResult {
  const joined = Array.isArray(raw) ? raw.join(',') : raw
  if (!joined) return { names: [], qualifiers: [] }

  const names: SauceNaoName[] = []
  const qualifiers: SauceNaoName[] = []
  const seenNames = new Set<string>()
  const seenQualifiers = new Set<string>()

  for (const segment of joined.split(',')) {
    const full = cleanEntityName(segment)
    if (!full) continue

    let base = full
    const collected: string[] = []
    let match = base.match(TRAILING_QUALIFIER)
    while (match) {
      const [, rest, qualifier] = match
      if (!rest.trim()) break // The whole segment was just "(...)" - keep it as-is.
      collected.unshift(qualifier.trim())
      base = rest.trim()
      match = base.match(TRAILING_QUALIFIER)
    }

    const nameKey = base.toLowerCase()
    if (!seenNames.has(nameKey)) {
      seenNames.add(nameKey)
      names.push(collected.length > 0 ? { name: base, altNames: [full] } : { name: base })
    }

    for (const qualifier of collected) {
      const cleaned = cleanEntityName(qualifier)
      if (!cleaned) continue
      const qualifierKey = cleaned.toLowerCase()
      if (!seenQualifiers.has(qualifierKey)) {
        seenQualifiers.add(qualifierKey)
        qualifiers.push({ name: cleaned })
      }
    }
  }

  return { names, qualifiers }
}

export function splitBooruList(raw: string | string[] | undefined): SauceNaoName[] {
  return splitBooruListWithQualifiers(raw).names
}

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

function cleanIndexName(raw: string | undefined): string {
  if (!raw) return 'Unknown source'
  const cleaned = raw.replace(/^Index #\d+:\s*/i, '').trim()
  return cleaned || 'Unknown source'
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
): SauceNaoLookup {
  const remaining = {
    short: parsed.header?.short_remaining ?? 0,
    long: parsed.header?.long_remaining ?? 0
  }

  const candidates = (parsed.results ?? [])
    .map((result) => ({
      similarity: Number.parseFloat(String(result.header?.similarity ?? '')) || 0,
      indexName: cleanIndexName(result.header?.index_name),
      data: result.data ?? {}
    }))
    .filter((candidate) => candidate.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)

  if (candidates.length === 0) return { match: null, remaining }

  const withMetadata = candidates.find(
    (candidate) => candidate.data.characters || candidate.data.material || candidate.data.creator
  )
  const chosen = withMetadata ?? candidates[0]

  const characters = splitBooruListWithQualifiers(chosen.data.characters)
  const series = splitBooruList(chosen.data.material)
  const seriesKeys = new Set(series.map((entry) => entry.name.toLowerCase()))
  const seriesHints = characters.qualifiers.filter(
    (qualifier) => !seriesKeys.has(qualifier.name.toLowerCase())
  )

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

  const match: SauceNaoMatch = {
    similarity: chosen.similarity,
    indexName: chosen.indexName,
    sourceUrl: chosen.data.ext_urls?.[0],
    title: chosen.data.title ?? chosen.data.eng_name,
    artist,
    characters: characters.names,
    series,
    seriesHints,
    tags: []
  }

  return { match, remaining }
}
