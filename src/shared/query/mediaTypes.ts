import type { MediaType } from '@shared/models'

/** Display and storage order of the types in a type filter. */
export const MEDIA_TYPES: readonly MediaType[] = ['image', 'gif', 'video']

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

/**
 * The type filter after checking or unchecking one type. Nothing checked
 * means every type, like a column filter in Explorer; all three stay checked
 * as the user left them, so the boxes don't jump.
 */
export function toggleType(
  types: MediaType[] | undefined,
  type: MediaType,
  checked: boolean
): MediaType[] | undefined {
  const next = MEDIA_TYPES.filter((each) => (each === type ? checked : types?.includes(each)))
  return next.length > 0 ? next : undefined
}
