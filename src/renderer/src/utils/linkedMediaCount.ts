/**
 * Every media still linked to an entity, pending included - what deleting it
 * would detach. The count shown on the Metadata page leaves pending out.
 */
export function linkedMediaCount(entity: {
  mediaCount?: number
  pendingMediaCount?: number
}): number {
  return (entity.mediaCount ?? 0) + (entity.pendingMediaCount ?? 0)
}
