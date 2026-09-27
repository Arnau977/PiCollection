import { getDb } from '../database/connection'
import * as cacheRepo from '../database/repositories/danbooruCharacterCache.repository'
import type { DanbooruCharacterInfo } from '@shared/models'
import { parseCharacterTag, toBooruTag } from '@shared/utils'
import { danbooruFetch } from './danbooruHttp'
import { readDanbooruCredentials } from './danbooruSettings'
import { logError } from '../logging/logger'

const REQUEST_TIMEOUT_MS = 8000
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
/** A copyright counts as the character's series when it's on at least this share of its posts. */
const MIN_SERIES_FREQUENCY = 0.5
const API = 'https://danbooru.donmai.us'

async function getJson(url: URL): Promise<unknown> {
  const res = await danbooruFetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Danbooru returned ${res.status} for ${url.pathname}`)
  return JSON.parse(await res.text())
}

/** Active implications among `tags`, as antecedent -> consequents. One request for all of them. */
async function fetchImplications(tags: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (tags.length === 0) return map
  const url = new URL(`${API}/tag_implications.json`)
  url.searchParams.set('search[antecedent_name_comma]', tags.join(','))
  url.searchParams.set('search[status]', 'active')
  url.searchParams.set('limit', '200')
  const body = await getJson(url)
  if (!Array.isArray(body)) return map
  for (const row of body as { antecedent_name?: unknown; consequent_name?: unknown }[]) {
    if (typeof row.antecedent_name !== 'string' || typeof row.consequent_name !== 'string') continue
    map.set(row.antecedent_name, [...(map.get(row.antecedent_name) ?? []), row.consequent_name])
  }
  return map
}

/** Copyright tags on at least MIN_SERIES_FREQUENCY of the character's posts. */
async function fetchCopyrights(characterTag: string): Promise<string[]> {
  const url = new URL(`${API}/related_tag.json`)
  url.searchParams.set('query', characterTag)
  url.searchParams.set('category', 'copyright')
  url.searchParams.set('limit', '10')
  const body = (await getJson(url)) as { related_tags?: unknown }
  if (!Array.isArray(body.related_tags)) return []
  return (body.related_tags as { tag?: { name?: unknown }; frequency?: unknown }[])
    .filter(
      (entry) => typeof entry.frequency === 'number' && entry.frequency >= MIN_SERIES_FREQUENCY
    )
    .map((entry) => entry.tag?.name)
    .filter((name): name is string => typeof name === 'string')
}

/**
 * The implication a form has to its base character: "pyra_(pro_swimmer)_(xenoblade)"
 * implies "pyra_(xenoblade)". A character can also imply unrelated tags, so
 * only a consequent sharing its base name counts.
 */
function parentFrom(tag: string, consequents: string[]): string | null {
  const base = parseCharacterTag(tag).base.replace(/\s+/g, '_')
  return consequents.find((consequent) => consequent !== tag && consequent.startsWith(base)) ?? null
}

/**
 * Asks Danbooru, for each character tag, which base character it's a form of
 * and which series it belongs to - the most specific one: when both
 * "xenoblade_chronicles_2" and "xenoblade_chronicles_(series)" qualify, the
 * latter is dropped because the former implies it. Answers are cached for 30
 * days (empty ones too). Needs a Danbooru account, like every Danbooru call
 * here; without one, or if Danbooru fails, returns only what's cached and the
 * renderer falls back to reading the tag's parentheses. Never throws.
 */
export async function resolveCharacterTags(names: string[]): Promise<DanbooruCharacterInfo[]> {
  const tags = Array.from(new Set(names.map(toBooruTag).filter(Boolean)))
  if (tags.length === 0) return []
  const db = getDb()

  const now = Date.now()
  const known = new Map<string, DanbooruCharacterInfo>()
  for (const row of await cacheRepo.findCachedCharacters(db, tags)) {
    if (now - row.fetched_at > CACHE_MAX_AGE_MS) continue
    known.set(row.tag_name, {
      tag: row.tag_name,
      parentTag: row.parent_tag,
      series: JSON.parse(row.series_json) as string[]
    })
  }

  const missing = tags.filter((tag) => !known.has(tag))
  if (missing.length > 0 && readDanbooruCredentials()) {
    try {
      const implications = await fetchImplications(missing)
      const parents = new Map(
        missing.map((tag) => [tag, parentFrom(tag, implications.get(tag) ?? [])])
      )

      const roots = Array.from(new Set(missing.map((tag) => parents.get(tag) ?? tag)))
      const copyrightsByRoot = new Map<string, string[]>()
      for (const root of roots) copyrightsByRoot.set(root, await fetchCopyrights(root))

      const allCopyrights = Array.from(new Set([...copyrightsByRoot.values()].flat()))
      const copyrightImplications = await fetchImplications(allCopyrights)
      const mostSpecific = (copyrights: string[]): string[] =>
        copyrights.filter(
          (candidate) =>
            !copyrights.some(
              (other) =>
                other !== candidate && copyrightImplications.get(other)?.includes(candidate)
            )
        )

      const fetched = missing.map((tag) => ({
        tag,
        parentTag: parents.get(tag) ?? null,
        series: mostSpecific(copyrightsByRoot.get(parents.get(tag) ?? tag) ?? [])
      }))
      await cacheRepo.upsertCachedCharacters(
        db,
        fetched.map((info) => ({
          tag_name: info.tag,
          parent_tag: info.parentTag,
          series_json: JSON.stringify(info.series),
          fetched_at: now
        }))
      )
      for (const info of fetched) known.set(info.tag, info)
    } catch (err) {
      // Not cached: a network hiccup shouldn't hide the answer for 30 days.
      logError('danbooru', 'Character lookup failed', {
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return tags.flatMap((tag) => {
    const info = known.get(tag)
    return info ? [info] : []
  })
}
