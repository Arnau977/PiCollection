/**
 * The WD14 label CSV's own category column: 0 = general descriptive tag,
 * 4 = character, 3 = copyright (the series/franchise a character belongs
 * to), 9 = content rating. Unlike the other three, rating is mutually
 * exclusive - only the single highest-scoring one is ever reported, never
 * threshold-filtered. See resources/wd14_predict.py.
 */
export type Wd14TagCategory = 'general' | 'character' | 'copyright' | 'rating'

export interface Wd14TagSuggestion {
  name: string
  score: number
  category: Wd14TagCategory
}
