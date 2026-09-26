export interface TagModel {
  id: string
  name: string
  aliases?: string[]
  createdAt?: number
  /** Media in the library (pending excluded). */
  mediaCount?: number
  /** Pending media still linked to it - only matters when deleting it. */
  pendingMediaCount?: number
}

export interface TagInput {
  name: string
  aliases?: string[]
}
