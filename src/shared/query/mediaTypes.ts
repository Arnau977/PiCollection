import type { MediaType } from '@shared/models'

/** Display and storage order of the types in a type filter. */
export const MEDIA_TYPES: readonly MediaType[] = ['image', 'gif', 'video']

/**
 * The type filter's choices: each type alone, then each pair. All three is
 * the same as no filter, so it isn't a choice of its own.
 */
export const TYPE_FILTER_CHOICES: readonly MediaType[][] = [
  ['image'],
  ['gif'],
  ['video'],
  ['image', 'gif'],
  ['image', 'video'],
  ['gif', 'video']
]

/**
 * The type filter in its stored form: known types, deduped, in MEDIA_TYPES
 * order; undefined when it filters nothing (none or all of them). Also reads
 * the single type older saved filters hold.
 */
export function normalizeTypes(value: unknown): MediaType[] | undefined {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value]
  const types = MEDIA_TYPES.filter((type) => values.includes(type))
  return types.length === 0 || types.length === MEDIA_TYPES.length ? undefined : types
}

/** A `<select>` value for a type filter: 'all', or the types joined by commas. */
export function typeFilterValue(types: MediaType[] | undefined): string {
  return normalizeTypes(types)?.join(',') ?? 'all'
}

export function typesFromFilterValue(value: string): MediaType[] | undefined {
  return value === 'all' ? undefined : normalizeTypes(value.split(','))
}
