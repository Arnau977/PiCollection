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
  sourceUrl?: string
  sfw: boolean
  isAiGenerated: boolean
  createdAt: number
  artist?: ArtistModel
  tags?: TagModel[]
  characters?: CharacterModel[]
  series?: SeriesModel[]
  pendingTagging: boolean
  /** What the source site had, as captured by the browser extension. Informational only. */
  sourceMetadata?: MediaSourceMetadata
}

/** Raw names from a capture's source site (booru style, e.g. `closed_eyes`). */
export interface MediaSourceMetadata {
  site?: string
  artist?: string
  tags: string[]
  characters: string[]
  series: string[]
  /** The rating chosen at capture time - a suggestion, the media itself starts NSFW. */
  sfw?: boolean
  isAiGenerated?: boolean
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
  /** Media with no character linked at all. Mutually exclusive with `characterGroups` in the UI. */
  noCharacter?: boolean
  /**
   * Ids in `characterGroups` matched only by a direct link - not through
   * their forms (e.g. media tagged Mythra, whether or not it also has
   * Mythra (Pro Swimmer), but not media tagged only with the form).
   */
  exactCharacterIds?: string[]
  /** Each inner array is AND'd together; the outer arrays are OR'd. */
  seriesGroups?: string[][]
  /** Media with no series linked at all. Mutually exclusive with `seriesGroups` in the UI. */
  noSeries?: boolean
  /** Ids in `seriesGroups` matched only by a direct link, not through their subseries. */
  exactSeriesIds?: string[]
  pendingTagging?: boolean
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
  /**
   * Set when it's listed because one was made from the other rather than for
   * looking alike: 'source' = the video this GIF came from, 'derived' = a GIF
   * made from this video. `distance` is 0 then.
   */
  relation?: 'source' | 'derived'
}

/** Generator traces found inside a file's own metadata (see aiMetadata.service). */
export interface AiMetadataDetection {
  /** Display name: "ComfyUI", "Stable Diffusion WebUI", "Content Credentials"... */
  generator: string
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
  sourceUrl?: string
  sfw: boolean
  isAiGenerated: boolean
  artistId?: string
  tagIds?: string[]
  characterIds?: string[]
  seriesIds?: string[]
  pendingTagging?: boolean
}

/**
 * "Replace with this file" on a similar match: `targetId` (the match) takes
 * over `route` and keeps its own metadata, plus these ids. `sourceMediaId`
 * is the current file's own row, when it has one (pending, or saved earlier).
 */
export interface MediaReplaceInput {
  targetId: string
  route: string
  type: MediaModel['type']
  sourceMediaId?: string
  artistId?: string
  tagIds: string[]
  characterIds: string[]
  seriesIds: string[]
}

export interface MediaBatchUpdateAssociationsInput {
  mediaIds: string[]
  addTagIds: string[]
  removeTagIds: string[]
  addCharacterIds: string[]
  removeCharacterIds: string[]
  addSeriesIds: string[]
  removeSeriesIds: string[]
  /** Omitted (not `undefined` vs `false`-checked) means "leave unchanged". */
  sfw?: boolean
}
