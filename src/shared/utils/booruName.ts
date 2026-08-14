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
export function splitBooruListWithQualifiers(raw: string | string[] | undefined): SplitResult {
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
