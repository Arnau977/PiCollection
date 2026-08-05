import { ArtistModel } from './Artist'
import { CharacterModel } from './Character'
import { TagModel } from './Tag'
import { SeriesModel } from './Series'

export interface MediaModel {
  id: string
  type: 'image' | 'video' | 'gif'
  route: string
  name: string
  alias?: string
  sfw: boolean
  isAiGenerated: boolean
  createdAt: number
  artist?: ArtistModel
  tags?: TagModel[]
  characters?: CharacterModel[]
  series?: SeriesModel[]
}

export interface MediaFilters {
  /** Free-text search expression: space=AND, `OR`=OR, `-`=NOT, parentheses group. */
  query?: string
  artistId?: string
  sfw?: boolean
  isAiGenerated?: boolean
  type?: 'image' | 'video' | 'gif'
  /** Each inner array is AND'd together; the outer arrays are OR'd. */
  tagGroups?: string[][]
  /** Each inner array is AND'd together; the outer arrays are OR'd. */
  characterGroups?: string[][]
  seriesIds?: string[]
  seriesOperator?: 'AND' | 'OR'
  limit?: number
  offset?: number
}

export interface MediaFilteredResult {
  items: MediaModel[]
  total: number
}

export interface MediaDuplicateMatch {
  media: MediaModel
  /** Perceptual-hash Hamming distance out of 64 bits - lower is more similar. */
  distance: number
}

export interface MediaDuplicateCheck {
  /** Same file, by path or exact content hash - the add should be blocked. */
  exactMatch: MediaModel | null
  /** Visually similar existing media (recompressed/resized copies) - informational only. */
  similar: MediaDuplicateMatch[]
}

export interface MediaInput {
  name: string
  type: 'image' | 'video' | 'gif'
  route: string
  alias?: string
  sfw: boolean
  isAiGenerated: boolean
  artistId?: string
  tagIds?: string[]
  characterIds?: string[]
  seriesIds?: string[]
}
