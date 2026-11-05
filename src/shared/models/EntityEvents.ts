/** Entity types whose list/mediaCount cache can go stale in the renderer when media associations change. */
export type EntityKind = 'tag' | 'character' | 'series' | 'artist' | 'filterList'

export interface EntitiesChangedEvent {
  kinds: EntityKind[]
}
