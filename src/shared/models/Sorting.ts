export type MediaSortableProp = 'name' | 'createdAt'

export interface Sorting {
  prop?: MediaSortableProp
  desc?: boolean
}
