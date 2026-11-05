import type { MediaFilters, SavedFilters } from '@shared/models'
import { parseGroupEntry } from './groupEntry'
import {
  extractAiToken,
  parseSearchQuery,
  serializeSearchQuery,
  type QueryNode
} from './searchQuery'

/** A filter that holds one value, so two different values can't both apply. */
const SCALAR_KEYS = ['artistId', 'sfw', 'isAiGenerated', 'type'] as const

const GROUP_KEYS = ['tagGroups', 'characterGroups', 'seriesGroups'] as const

const EXACT_KEYS = [
  ['exactCharacterIds', 'characterGroups'],
  ['exactSeriesIds', 'seriesGroups']
] as const

const NONE_KEYS = ['noArtist', 'noCharacter', 'noSeries'] as const

interface SplitQuery {
  node: QueryNode | null
  isAiGenerated?: boolean
}

/** Same precedence as the repository: a structured AI filter beats the query's `ai` word. */
function splitQuery(filters: SavedFilters): SplitQuery {
  const parsed = filters.query?.trim() ? parseSearchQuery(filters.query) : null
  const { node, isAiGenerated } = extractAiToken(parsed)
  return { node, isAiGenerated: filters.isAiGenerated ?? isAiGenerated }
}

/**
 * Groups are OR'd, so requiring both sides means pairing every group of one
 * with every group of the other. Entries are deduped because a group matches
 * by counting distinct ids, so `[x, x]` would match nothing.
 */
function crossGroups(a: string[][] | undefined, b: string[][] | undefined): string[][] | undefined {
  const left = (a ?? []).filter((group) => group.length > 0)
  const right = (b ?? []).filter((group) => group.length > 0)
  if (left.length === 0 && right.length === 0) return undefined
  if (left.length === 0) return right
  if (right.length === 0) return left
  return left.flatMap((l) => right.map((r) => [...new Set([...l, ...r])]))
}

/** What a side excludes along with its forms or subseries: it didn't mark the id exact. */
function plainExclusions(groups: string[][] | undefined, exact: string[] | undefined): string[] {
  return (groups ?? [])
    .flat()
    .map(parseGroupEntry)
    .filter((entry) => entry.excluded && !exact?.includes(entry.id))
    .map((entry) => entry.id)
}

/**
 * Exact ids apply to the whole query, so one side's pick mustn't narrow the
 * other's exclusion: "Apta" leaving out a character's forms stays that way.
 * A side's own exact exclusion is kept, or it would lose those forms itself.
 */
function mergeExactIds(
  a: string[] | undefined,
  aGroups: string[][] | undefined,
  b: string[] | undefined,
  bGroups: string[][] | undefined
): string[] | undefined {
  const excluded = new Set([...plainExclusions(aGroups, a), ...plainExclusions(bGroups, b)])
  const ids = [...new Set([...(a ?? []), ...(b ?? [])])].filter((id) => !excluded.has(id))
  return ids.length > 0 ? ids : undefined
}

/**
 * The filters that require both `base` and `extra`, or null when they can
 * never match together. Fields `extra` can't hold (paging, Pending) stay as
 * they are on `base`.
 */
export function mergeFilters(base: MediaFilters, extra: SavedFilters): MediaFilters | null {
  const baseQuery = splitQuery(base)
  const extraQuery = splitQuery(extra)
  const left: SavedFilters = { ...base, isAiGenerated: baseQuery.isAiGenerated }
  const right: SavedFilters = { ...extra, isAiGenerated: extraQuery.isAiGenerated }

  const merged: MediaFilters = { ...base }

  for (const key of SCALAR_KEYS) {
    const [a, b] = [left[key], right[key]]
    if (a !== undefined && b !== undefined && a !== b) return null
    Object.assign(merged, { [key]: a ?? b })
  }

  for (const key of GROUP_KEYS) merged[key] = crossGroups(base[key], extra[key])

  for (const [key, groupsKey] of EXACT_KEYS) {
    merged[key] = mergeExactIds(base[key], base[groupsKey], extra[key], extra[groupsKey])
  }

  for (const key of NONE_KEYS) {
    if (base[key] || extra[key]) merged[key] = true
  }

  const nodes = [baseQuery.node, extraQuery.node].filter((node) => node !== null)
  merged.query =
    nodes.length > 0
      ? serializeSearchQuery(nodes.length === 1 ? nodes[0] : { type: 'and', children: nodes })
      : undefined

  return merged
}
