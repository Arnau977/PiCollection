import type { SeriesModel } from './Series'

export interface CharacterModel {
  id: string
  name: string
  series: SeriesModel[]
  aliases?: string[]
  createdAt?: number
  mediaCount?: number
}

export interface CharacterInput {
  name: string
  seriesIds?: string[]
  aliases?: string[]
}
