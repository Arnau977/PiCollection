import type { CharacterModel, SauceNaoName, SeriesModel } from '@shared/models'
import { normalizeForMatch } from './fuzzyMatch'

export interface NameMatchable {
  id: string
  name: string
  aliases?: string[]
}

export interface NameMatchResult<T> {
  existing: T[]
  missing: string[]
}

/** NFKC-normalized, lowercased, underscore/whitespace collapsed. */
export function normalizeEntityName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim()
}

/** Uppercases just the first character - booru-sourced names arrive lowercase. */
export function capitalizeFirstLetter(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Uppercases the first letter of every word (booru/WD14 tags arrive all
 * lowercase, e.g. "large breasts", "power (chainsaw man)") - display-only
 * title-casing, not a normalization used for matching. A leading digit run
 * ("1girl") is left as-is rather than capitalizing the letter after it,
 * since there's no reliable way to tell a genuine word boundary from a
 * booru-style count prefix.
 */
export function titleCaseTagName(value: string): string {
  return value.replace(
    /(^|[\s(])([a-z])/g,
    (_match, boundary: string, letter: string) => `${boundary}${letter.toUpperCase()}`
  )
}

/**
 * Splits suggested names into ones that already exist in the library
 * (matched by name or alias) and ones that don't yet exist (the clean base
 * name only - never a qualified "X (Y)" form, so anything created from it
 * stays clean).
 */
export function matchEntityNames<T extends NameMatchable>(
  suggestions: SauceNaoName[],
  options: T[]
): NameMatchResult<T> {
  const index = new Map<string, T>()
  // Two passes: real names first, then aliases, so a real name always wins
  // over another entity's alias on a collision.
  for (const option of options) {
    const key = normalizeEntityName(option.name)
    if (!index.has(key)) index.set(key, option)
  }
  for (const option of options) {
    for (const alias of option.aliases ?? []) {
      const key = normalizeEntityName(alias)
      if (!index.has(key)) index.set(key, option)
    }
  }

  const existing: T[] = []
  const missing: string[] = []
  const seenIds = new Set<string>()
  const seenMissing = new Set<string>()

  for (const suggestion of suggestions) {
    const candidateNames = [suggestion.name, ...(suggestion.altNames ?? [])]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    let hit: T | undefined
    for (const candidate of candidateNames) {
      hit = index.get(normalizeEntityName(candidate))
      if (hit) break
    }

    if (hit) {
      if (!seenIds.has(hit.id)) {
        seenIds.add(hit.id)
        existing.push(hit)
      }
      continue
    }

    const cleanName = suggestion.name.trim()
    if (!cleanName) continue
    const missingKey = normalizeEntityName(cleanName)
    if (!seenMissing.has(missingKey)) {
      seenMissing.add(missingKey)
      missing.push(cleanName)
    }
  }

  return { existing, missing }
}

/** `"Name"` when the character has no linked series, `"Name (Series A, Series B)"` otherwise. */
export function formatCharacterOptionLabel(character: CharacterModel): string {
  if (character.series.length === 0) return character.name
  return `${character.name} (${character.series.map((s) => s.name).join(', ')})`
}

/**
 * `character.name` is the one entity name with no `UNIQUE` constraint in the
 * DB - two characters from different series can share a name. Unlike
 * `matchEntityNames` (which keeps only the first candidate for a given
 * name), this groups every candidate sharing a name/alias key and, when a
 * suggestion resolves to more than one, disambiguates using `seriesContext`
 * (the normalized series names SauceNAO's match implies). If exactly one
 * candidate's own series overlaps that context, it wins; otherwise this
 * falls back to the first candidate in array order - never worse than the
 * old behavior, only better when series information actually helps.
 */
/** "xenoblade" names "Xenoblade Chronicles 2" too: equal, or the start of it word-for-word. */
export function qualifierNamesSeries(qualifier: string, seriesName: string): boolean {
  const q = normalizeForMatch(qualifier)
  const s = normalizeForMatch(seriesName)
  return q.length > 0 && (s === q || s.startsWith(`${q} `))
}

/**
 * The library series a suggestion's own tag names, plus their ancestors and
 * descendants ("Fate" accepts a character linked to "Fate/Grand Order").
 * Null when it names none - then there's nothing to contradict.
 */
function seriesNamedBy(suggestion: SauceNaoName, library: SeriesModel[]): Set<string> | null {
  const named = library.filter((series) =>
    (suggestion.series ?? []).some((qualifier) =>
      [series.name, ...(series.aliases ?? [])].some((name) => qualifierNamesSeries(qualifier, name))
    )
  )
  if (named.length === 0) return null
  const related = new Set(named.map((series) => series.id))
  const parentOf = new Map(library.map((series) => [series.id, series.parentId ?? null]))
  const isUnder = (id: string, ancestor: string): boolean => {
    for (let at = parentOf.get(id); at; at = parentOf.get(at)) if (at === ancestor) return true
    return false
  }
  for (const series of library) {
    if (named.some((n) => isUnder(series.id, n.id) || isUnder(n.id, series.id))) {
      related.add(series.id)
    }
  }
  return related
}

export function matchCharacterNames(
  suggestions: SauceNaoName[],
  characters: CharacterModel[],
  seriesContext: string[],
  /** Lets a series named by the tag itself rule out a character from another one. */
  librarySeries: SeriesModel[] = []
): NameMatchResult<CharacterModel> {
  const seriesContextSet = new Set(seriesContext)

  const index = new Map<string, CharacterModel[]>()
  for (const character of characters) {
    const key = normalizeEntityName(character.name)
    const group = index.get(key)
    if (group) group.push(character)
    else index.set(key, [character])
  }
  for (const character of characters) {
    for (const alias of character.aliases ?? []) {
      const key = normalizeEntityName(alias)
      if (!index.has(key)) index.set(key, [character])
    }
  }

  function resolve(candidates: CharacterModel[]): CharacterModel {
    if (candidates.length === 1) return candidates[0]
    const bySeries = candidates.filter((candidate) =>
      candidate.series.some((s) => seriesContextSet.has(normalizeEntityName(s.name)))
    )
    return bySeries.length === 1 ? bySeries[0] : candidates[0]
  }

  const existing: CharacterModel[] = []
  const missing: string[] = []
  const seenIds = new Set<string>()
  const seenMissing = new Set<string>()

  for (const suggestion of suggestions) {
    // The full tag ("Hatsune Miku (Symphony)") first: it's more specific
    // than the de-qualified name, which may be the costume's base character.
    const candidateNames = [...(suggestion.altNames ?? []), suggestion.name]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    let group: CharacterModel[] | undefined
    let matchedName = ''
    for (const candidate of candidateNames) {
      group = index.get(normalizeEntityName(candidate))
      matchedName = candidate
      if (group) break
    }

    // Found only by the bare name ("Asuna") while the tag itself names a
    // library series ("Asuna (Blue Archive)"): a character linked only to
    // other series is someone else who shares the name, not this one.
    const named = seriesNamedBy(suggestion, librarySeries)
    if (group && named && !matchedName.includes('(')) {
      group = group.filter(
        (character) =>
          character.series.length === 0 || character.series.some((s) => named.has(s.id))
      )
      if (group.length === 0) group = undefined
    }

    if (group) {
      const hit = resolve(group)
      if (!seenIds.has(hit.id)) {
        seenIds.add(hit.id)
        existing.push(hit)
      }
      continue
    }

    const cleanName = suggestion.name.trim()
    if (!cleanName) continue
    const missingKey = normalizeEntityName(cleanName)
    if (!seenMissing.has(missingKey)) {
      seenMissing.add(missingKey)
      missing.push(cleanName)
    }
  }

  return { existing, missing }
}
