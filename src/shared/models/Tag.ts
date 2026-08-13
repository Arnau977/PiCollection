export interface TagModel {
  id: string
  name: string
  aliases?: string[]
  createdAt?: number
  mediaCount?: number
}

export interface TagInput {
  name: string
  aliases?: string[]
}
