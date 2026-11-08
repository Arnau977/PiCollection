import type { TFunction } from 'i18next'
import type { MediaType } from '@shared/models'

/** "Image", or "Image or animated" for a pair - how a type filter reads. */
export function typeFilterLabel(types: MediaType[], t: TFunction): string {
  const names: Record<MediaType, string> = {
    image: t('filters.typeImage'),
    gif: t('filters.typeGif'),
    video: t('filters.typeVideo')
  }
  return types.length === 1
    ? names[types[0]]
    : t('filters.typeEither', { first: names[types[0]], second: names[types[1]].toLowerCase() })
}
