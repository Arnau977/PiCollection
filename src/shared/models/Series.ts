export interface SeriesModel {
  id: string
  name: string
  aliases?: string[]
  createdAt?: number
  parentId?: string | null
  mediaCount?: number
}

export interface SeriesInput {
  name: string
  aliases?: string[]
  parentId?: string | null
}
