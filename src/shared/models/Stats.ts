export interface EntityCount {
  id: string
  name: string
  count: number
}

export interface StatsSummary {
  topArtists: EntityCount[]
  topTags: EntityCount[]
  topCharacters: EntityCount[]
  topSeries: EntityCount[]
}
