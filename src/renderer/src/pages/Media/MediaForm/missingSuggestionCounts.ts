import type { SuggestionCategory } from '../../../hooks/useSauceNaoSuggestions'
import type { MediaFormSuggestions } from './useMediaFormSuggestions'

export const SAUCE_MISSING_CATEGORIES: { category: SuggestionCategory; labelKey: string }[] = [
  { category: 'artist', labelKey: 'sauceNao.missingArtist' },
  { category: 'tags', labelKey: 'sauceNao.missingTags' },
  { category: 'characters', labelKey: 'sauceNao.missingCharacters' },
  { category: 'series', labelKey: 'sauceNao.missingSeries' }
]

// WD14 never suggests an artist - reuses the same category labels as SauceNAO's panel.
export const WD14_MISSING_CATEGORIES: {
  category: Extract<SuggestionCategory, 'tags' | 'characters' | 'series'>
  labelKey: string
}[] = [
  { category: 'tags', labelKey: 'sauceNao.missingTags' },
  { category: 'characters', labelKey: 'sauceNao.missingCharacters' },
  { category: 'series', labelKey: 'sauceNao.missingSeries' }
]

export function countSauceMissing(missing: MediaFormSuggestions['sauce']['missing']): number {
  return SAUCE_MISSING_CATEGORIES.reduce((sum, { category }) => sum + missing[category].length, 0)
}

/** Library names "add all" links - artists excluded, the user picks one of several credits. */
export function countSourceLinkable(source: MediaFormSuggestions['source']): number {
  const { tags, characters, series } = source.existing
  return tags.length + characters.length + series.length
}

/** Every chip and hint the source panel still offers. */
export function countSourceSuggestions(source: MediaFormSuggestions['source']): number {
  return (
    countSauceMissing(source.missing) +
    countSourceLinkable(source) +
    source.existing.artist.length +
    (source.suggestedSfw !== undefined ? 1 : 0) +
    (source.suggestsAiGenerated ? 1 : 0)
  )
}

export function countWd14Missing(missing: MediaFormSuggestions['wd14']['missing']): number {
  return WD14_MISSING_CATEGORIES.reduce((sum, { category }) => sum + missing[category].length, 0)
}
