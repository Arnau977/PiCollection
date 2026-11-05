import type { SavedFilters } from './Media'

/** A named set of gallery filters, which can also include other lists. */
export interface FilterListModel {
  id: string
  name: string
  filters: SavedFilters
  includedListIds: string[]
  /** One of its tags, characters, series or its artist no longer exists. */
  hasMissingEntities: boolean
  createdAt: number
  updatedAt: number
}

export interface FilterListInput {
  name: string
  filters: SavedFilters
  includedListIds: string[]
}
