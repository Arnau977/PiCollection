import type { SeriesModel } from './Series'

export interface CharacterModel {
  id: string
  name: string
  series: SeriesModel[]
  aliases?: string[]
  createdAt?: number
  /** Media in the library (pending excluded). */
  mediaCount?: number
  /** Pending media still linked to it - only matters when deleting it. */
  pendingMediaCount?: number
  parentId?: string | null
  /** Characters this one is an expy of (not a hierarchy: never expands searches). */
  inspiredByIds?: string[]
}

export interface CharacterInput {
  name: string
  seriesIds?: string[]
  aliases?: string[]
  parentId?: string | null
  /** Left untouched when omitted. */
  inspiredByIds?: string[]
}
