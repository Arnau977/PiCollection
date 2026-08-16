const STORAGE_KEY = 'picollection:wd14-nsfw-threshold'

export type Wd14NsfwThreshold = 'sensitive' | 'questionable' | 'explicit'

/** Danbooru's 4-tier rating, ordered least to most explicit - matches the
 *  labels resources/wd14_predict.py reports under the "rating" category. */
export const WD14_RATING_ORDER = ['general', 'sensitive', 'questionable', 'explicit'] as const

export const DEFAULT_WD14_NSFW_THRESHOLD: Wd14NsfwThreshold = 'questionable'

export function loadWd14NsfwThreshold(): Wd14NsfwThreshold {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return raw === 'sensitive' || raw === 'questionable' || raw === 'explicit'
    ? raw
    : DEFAULT_WD14_NSFW_THRESHOLD
}

export function saveWd14NsfwThreshold(threshold: Wd14NsfwThreshold): void {
  window.localStorage.setItem(STORAGE_KEY, threshold)
}

/** Whether the model's rating label falls at or past the configured NSFW threshold. */
export function wd14RatingIsNsfw(rating: string, threshold: Wd14NsfwThreshold): boolean {
  const ratingRank = WD14_RATING_ORDER.indexOf(rating as (typeof WD14_RATING_ORDER)[number])
  return ratingRank >= WD14_RATING_ORDER.indexOf(threshold)
}
