/** File properties a rule can turn into one of the user's tags. */
export const AUTO_TAG_PROPERTIES = [
  'transparent',
  'lowres',
  'highres',
  'absurdres',
  'incredibly_absurdres',
  'tall_image',
  'wide_image',
  'portrait',
  'landscape',
  'square'
] as const

export type AutoTagProperty = (typeof AUTO_TAG_PROPERTIES)[number]

/**
 * Size rules copied from Danbooru's own auto-applied tags (their wiki pages,
 * checked 2026-10-22), so a rule given the matching tag agrees with what
 * SauceNAO/WD14 suggest. They stack like Danbooru's: absurdres is highres too.
 */
export const DANBOORU_SIZES = {
  /** Both sides at most this (≈ 0.25 MP). */
  lowresMaxSide: 500,
  highres: { width: 1600, height: 1200 },
  absurdres: { width: 3200, height: 2400 },
  incrediblyAbsurdresSide: 10000,
  /** tall_image / wide_image: the long side at least this, and 4 times the other. */
  extremeMinSide: 1024,
  extremeRatio: 4
} as const

/** Danbooru's tag for each property; portrait/landscape/square have none. */
export const DANBOORU_DEFAULT_TAGS: Partial<Record<AutoTagProperty, string>> = {
  transparent: 'transparent background',
  lowres: 'lowres',
  highres: 'highres',
  absurdres: 'absurdres',
  incredibly_absurdres: 'incredibly absurdres',
  tall_image: 'tall image',
  wide_image: 'wide image'
}
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
