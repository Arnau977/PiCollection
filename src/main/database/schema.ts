export interface ArtistTable {
  id: string
  name: string
  created_at: number
}

export interface ArtistSocialLinkTable {
  id: string
  artist_id: string
  name: string
  url: string
  icon: string | null
  position: number
}

export interface CharacterTable {
  id: string
  name: string
  aliases_json: string
  created_at: number
}

export interface SeriesTable {
  id: string
  name: string
  aliases_json: string
  created_at: number
}

export interface CharacterSeriesTable {
  character_id: string
  series_id: string
}

export interface TagTable {
  id: string
  name: string
  created_at: number
}

export interface MediaTable {
  id: string
  name: string
  sfw: number
  is_ai_generated: number
  type: string
  route: string
  alias: string | null
  artist_id: string | null
  created_at: number
  /** SHA-256 of the file's content, null when never computed or the file was unreadable. */
  hash: string | null
  /** 64-bit perceptual hash (hex), null under the same conditions as `hash`. */
  phash: string | null
}

export interface MediaTagTable {
  media_id: string
  tag_id: string
}

export interface MediaCharacterTable {
  media_id: string
  character_id: string
}

export interface MediaSeriesTable {
  media_id: string
  series_id: string
}

export interface DB {
  artist: ArtistTable
  artist_social_link: ArtistSocialLinkTable
  character: CharacterTable
  series: SeriesTable
  character_series: CharacterSeriesTable
  tag: TagTable
  media: MediaTable
  media_tag: MediaTagTable
  media_character: MediaCharacterTable
  media_series: MediaSeriesTable
}
