import type { SauceNaoName } from '@shared/models'

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
