export interface SeriesModel {
  id: string
  name: string
  aliases?: string[]
}

export interface SeriesInput {
  name: string
  aliases?: string[]
}
