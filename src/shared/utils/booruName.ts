import type { SauceNaoName } from '../models'

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

/** "Pyra (Pro Swimmer) (Xenoblade)" -> "pyra_(pro_swimmer)_(xenoblade)", the form Danbooru's API expects. */
export function toBooruTag(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_')
}

export interface CharacterTagParts {
  /** The name with every trailing "(...)" removed, e.g. "pyra". */
  base: string
  /** The trailing qualifiers in order, e.g. ["pro swimmer", "xenoblade"]. */
  qualifiers: string[]
}

/**
 * Splits one booru character tag ("pyra_(pro_swimmer)_(xenoblade)" or its
 * cleaned form) into its base name and trailing qualifiers. Deciding which
 * qualifier is a series and which a form/costume is left to the caller.
 */
export function parseCharacterTag(raw: string): CharacterTagParts {
  let base = cleanEntityName(raw)
  const qualifiers: string[] = []
  let match = base.match(TRAILING_QUALIFIER)
  while (match) {
    const [, rest, qualifier] = match
    if (!rest.trim()) break
    const cleaned = cleanEntityName(qualifier)
    if (cleaned) qualifiers.unshift(cleaned)
    base = rest.trim()
    match = base.match(TRAILING_QUALIFIER)
  }
  return { base, qualifiers }
}

/**
 * A booru character list, one entry per full tag with its qualifiers kept
 * ("pyra (xenoblade)" and "pyra (pro swimmer) (xenoblade)" stay two entries) -
 * which qualifier is a series and which a form is decided later, against the
 * library (see the renderer's resolveCharacterCandidates).
 */
export function splitBooruCharacterList(raw: string | string[] | undefined): SauceNaoName[] {
  const joined = Array.isArray(raw) ? raw.join(',') : raw
  if (!joined) return []
  const seen = new Set<string>()
  const names: SauceNaoName[] = []
  for (const segment of joined.split(',')) {
    const full = cleanEntityName(segment)
    const key = full.toLowerCase()
    if (!full || seen.has(key)) continue
    seen.add(key)
    names.push({ name: full })
  }
  return names
}

export function splitBooruList(raw: string | string[] | undefined): SauceNaoName[] {
  return splitBooruListWithQualifiers(raw).names
}

/** Booru sites flag fully generated posts with this tag (`ai-generated` on Danbooru, `ai_generated` on Rule34). */
export function isAiGeneratedTag(name: string): boolean {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-') === 'ai-generated'
  )
}

/**
 * A media has a single artist, but booru posts can credit several - the
 * extension sends them comma-joined. Trimmed, blanks and case-insensitive
 * repeats dropped.
 */
export function splitArtistCredits(raw: string | undefined): string[] {
  const seen = new Set<string>()
  return (raw ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLowerCase()
      if (!name || seen.has(key)) return false
      seen.add(key)
      return true
    })
}
