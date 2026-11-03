export interface EntityCount {
  id: string
  name: string
  count: number
}

export interface StatsSummary {
  topArtists: EntityCount[]
  topTags: EntityCount[]
  /** The same ranking without the tags automatic tag rules give. */
  topTagsWithoutAuto: EntityCount[]
  topCharacters: EntityCount[]
  topSeries: EntityCount[]
}
