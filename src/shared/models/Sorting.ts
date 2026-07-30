export type MediaSortableProp = 'name' | 'createdAt' | 'sfw'

export interface Sorting {
  prop?: MediaSortableProp
  desc?: boolean
}
