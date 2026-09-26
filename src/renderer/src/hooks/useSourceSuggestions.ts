import { useCallback, useMemo, useState } from 'react'
import type {
  ArtistModel,
  CharacterModel,
  MediaSourceMetadata,
  SeriesModel,
  TagModel
} from '@shared/models'
import { cleanEntityName, splitBooruListWithQualifiers } from '@shared/utils'
import { EMPTY_MISSING, matchSuggestionCandidate, type SuggestionCategory } from './tagSuggestionMatching'

interface UseSourceSuggestionsArgs {
  metadata?: MediaSourceMetadata
  artists: ArtistModel[]
  tags: TagModel[]
  characters: CharacterModel[]
  series: SeriesModel[]
}

export interface SourceSuggestions {
  /** False for media not captured by the extension (or captured before this was stored). */
  available: boolean
  site?: string
  missing: Record<SuggestionCategory, string[]>
  dismiss: (category: SuggestionCategory, name: string) => void
}

/**
 * The names a capture's source site had but the library doesn't (the capture
 * already linked the ones that exist). Unlike SauceNAO/WD14 there's no lookup
 * to run and nothing is ever applied automatically - these are offered as
 * "create" chips only, since the site's tagging is informational.
 */
export function useSourceSuggestions({
  metadata,
  artists,
  tags,
  characters,
  series
}: UseSourceSuggestionsArgs): SourceSuggestions {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const matched = useMemo(() => {
    if (!metadata) return EMPTY_MISSING
    const split = splitBooruListWithQualifiers(metadata.characters)
    const seriesKeys = new Set(metadata.series.map((s) => cleanEntityName(s).toLowerCase()))
    return matchSuggestionCandidate(
      {
        artist: metadata.artist ? { name: cleanEntityName(metadata.artist) } : null,
        tags: metadata.tags.map((name) => ({ name: cleanEntityName(name) })),
        characters: split.names,
        series: metadata.series.map((name) => ({ name: cleanEntityName(name) })),
        seriesHints: split.qualifiers.filter((q) => !seriesKeys.has(q.name.toLowerCase()))
      },
      { artists, tags, characters, series }
    ).missing
  }, [metadata, artists, tags, characters, series])

  const missing = useMemo(() => {
    const visible = (category: SuggestionCategory): string[] =>
      matched[category].filter((name) => !dismissed.has(`${category}:${name}`))
    return {
      artist: visible('artist'),
      tags: visible('tags'),
      characters: visible('characters'),
      series: visible('series')
    }
  }, [matched, dismissed])

  const dismiss = useCallback((category: SuggestionCategory, name: string) => {
    setDismissed((prev) => new Set(prev).add(`${category}:${name}`))
  }, [])

  return { available: Boolean(metadata), site: metadata?.site, missing, dismiss }
}
