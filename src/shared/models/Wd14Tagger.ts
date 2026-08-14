/**
 * The WD14 label CSV's own category column: 0 = general descriptive tag,
 * 4 = character, 3 = copyright (the series/franchise a character belongs
 * to). Only these three are ever requested - see resources/wd14_predict.py.
 */
export type Wd14TagCategory = 'general' | 'character' | 'copyright'

export interface Wd14TagSuggestion {
  name: string
  score: number
  category: Wd14TagCategory
}
