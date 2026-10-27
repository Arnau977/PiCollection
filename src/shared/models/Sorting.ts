export type MediaSortableProp = 'name' | 'createdAt' | 'fileSize'

export interface Sorting {
  prop?: MediaSortableProp
  desc?: boolean
}
