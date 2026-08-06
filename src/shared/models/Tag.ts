export interface TagModel {
  id: string
  name: string
  createdAt?: number
  mediaCount?: number
}

export interface TagInput {
  name: string
}
