export interface SeriesModel {
  id: string
  name: string
  aliases?: string[]
  createdAt: number
}

export interface SeriesInput {
  name: string
  aliases?: string[]
}
