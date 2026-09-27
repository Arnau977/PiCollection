import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ArtistModel,
  CharacterModel,
  DanbooruCharacterInfo,
  MediaSourceMetadata,
  SeriesModel,
  TagModel
} from '@shared/models'
import { cleanEntityName, splitBooruCharacterList } from '@shared/utils'
import { fetchDanbooruCharacters } from '../utils/fetchDanbooruCharacters'
import {
  EMPTY_MISSING,
  matchSuggestionCandidate,
  type SuggestionCategory
} from './tagSuggestionMatching'

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
  /** Missing character -> the base character it's a form of (see matchSuggestionCandidate). */
  characterParents: Record<string, string>
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
  const [danbooru, setDanbooru] = useState<DanbooruCharacterInfo[]>([])

  // Chips show right away from the tags' parentheses and refine once Danbooru answers.
  const characterNames = metadata?.characters.join(',') ?? ''
  useEffect(() => {
    let cancelled = false
    setDanbooru([])
    const names = splitBooruCharacterList(characterNames).map((c) => c.name)
    if (names.length === 0) return
    void fetchDanbooruCharacters(names).then((info) => {
      if (!cancelled) setDanbooru(info)
    })
    return (): void => {
      cancelled = true
    }
  }, [characterNames])

  const matched = useMemo(() => {
    if (!metadata) return { missing: EMPTY_MISSING, characterParents: {} }
    return matchSuggestionCandidate(
      {
        artist: metadata.artist ? { name: cleanEntityName(metadata.artist) } : null,
        tags: metadata.tags.map((name) => ({ name: cleanEntityName(name) })),
        characters: splitBooruCharacterList(metadata.characters),
        series: metadata.series.map((name) => ({ name: cleanEntityName(name) }))
      },
      { artists, tags, characters, series },
      danbooru
    )
  }, [metadata, artists, tags, characters, series, danbooru])

  const missing = useMemo(() => {
    const visible = (category: SuggestionCategory): string[] =>
      matched.missing[category].filter((name) => !dismissed.has(`${category}:${name}`))
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

  return {
    available: Boolean(metadata),
    site: metadata?.site,
    missing,
    characterParents: matched.characterParents,
    dismiss
  }
}
