/** File properties a rule can turn into one of the user's tags. */
export const AUTO_TAG_PROPERTIES = [
  'transparent',
  'high_res',
  'low_res',
  'portrait',
  'landscape',
  'square'
] as const

export type AutoTagProperty = (typeof AUTO_TAG_PROPERTIES)[number]

/** Longest side, in pixels, from which a picture counts as high resolution. */
export const HIGH_RES_MIN_SIDE = 3840
/** Longest side, in pixels, below which a picture counts as low resolution. */
export const LOW_RES_MAX_SIDE = 800
/** How much longer one side must be than the other to stop counting as square. */
export const ORIENTATION_TOLERANCE = 1.05

export interface AutoTagRule {
  property: AutoTagProperty
  tagId: string
}

export interface AutoTagStatus {
  rules: AutoTagRule[]
  /** Pictures still waiting for their size/transparency to be read. */
  unanalyzed: number
}

export interface AutoTagRuleInput {
  property: AutoTagProperty
  /** Null turns the rule off. */
  tagId: string | null
}
