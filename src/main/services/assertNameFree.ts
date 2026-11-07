import { AppError } from '../errors'

/**
 * A name's UNIQUE index only catches exact matches, but "Foo" and "foo" are the
 * same entity to the user. `ownId` lets one change the case of its own name.
 */
export function assertNameFree(
  existing: { id: string; name: string }[],
  name: string,
  ownId?: string
): void {
  const lowered = name.toLowerCase()
  if (existing.some((row) => row.id !== ownId && row.name.toLowerCase() === lowered)) {
    throw new AppError('DUPLICATE', 'That name is already in use.')
  }
}
