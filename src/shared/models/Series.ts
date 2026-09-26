export interface SeriesModel {
  id: string
  name: string
  aliases?: string[]
  createdAt?: number
  parentId?: string | null
  /** Media in the library (pending excluded). */
  mediaCount?: number
  /** Pending media still linked to it - only matters when deleting it. */
  pendingMediaCount?: number
}

export interface SeriesInput {
  name: string
  aliases?: string[]
  parentId?: string | null
}
