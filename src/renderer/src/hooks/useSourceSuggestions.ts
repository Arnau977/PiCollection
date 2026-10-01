import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ArtistModel,
  CharacterModel,
  DanbooruCharacterInfo,
  MediaInput,
  MediaSourceMetadata,
  SeriesModel,
  TagModel
} from '@shared/models'
import {
  cleanEntityName,
  isAiGeneratedTag,
  splitArtistCredits,
  splitBooruCharacterList
} from '@shared/utils'
import { fetchDanbooruCharacters } from '../utils/fetchDanbooruCharacters'
import { matchEntityNames, normalizeEntityName } from '../utils/matchEntityNames'
import {
  EMPTY_MISSING,
  matchSuggestionCandidate,
  type SuggestionCategory
} from './tagSuggestionMatching'

/**
 * Some sites (Pixiv) don't split characters and series from tags: every name
 * arrives as a tag. One the library only knows as a series or a character
 * (not as a tag) is offered as that instead - "Genshin Impact" as the series
 * you already have, not as a new tag.
 */
export function routeSourceTags(
  metadata: Pick<MediaSourceMetadata, 'tags' | 'characters' | 'series'>,
  library: { tags: TagModel[]; characters: CharacterModel[]; series: SeriesModel[] }
): { tags: string[]; characters: string[]; series: string[] } {
  const routed = { tags: [] as string[], characters: [...metadata.characters], series: [...metadata.series] }
  for (const tag of metadata.tags) {
    const name = [{ name: cleanEntityName(tag) }]
    if (matchEntityNames(name, library.tags).existing.length) routed.tags.push(tag)
    else if (matchEntityNames(name, library.series).existing.length) routed.series.push(tag)
    else if (matchEntityNames(name, library.characters).existing.length) routed.characters.push(tag)
    else routed.tags.push(tag)
  }
  return routed
}

interface UseSourceSuggestionsArgs {
  metadata?: MediaSourceMetadata
  /** The form's current values - suggestions it already has are hidden. */
  input: MediaInput
  artists: ArtistModel[]
  tags: TagModel[]
  characters: CharacterModel[]
  series: SeriesModel[]
}

export interface ExistingSuggestion {
  id: string
  name: string
}

export interface SourceSuggestions {
  /** False for media not captured by the extension (or captured before this was stored). */
  available: boolean
  site?: string
  /** Names the library already has - one click links them. */
  existing: Record<SuggestionCategory, ExistingSuggestion[]>
  /** Names the library doesn't have - one click creates them. */
  missing: Record<SuggestionCategory, string[]>
  /** Missing character -> the base character it's a form of (see matchSuggestionCandidate). */
  characterParents: Record<string, string>
  /** The site's rating, when it differs from the form's. */
  suggestedSfw?: boolean
  /** The site marked it AI-generated (flag or tag) and the form doesn't say so yet. */
  suggestsAiGenerated: boolean
  dismiss: (category: SuggestionCategory, name: string) => void
}

const EMPTY_EXISTING: Record<SuggestionCategory, ExistingSuggestion[]> = {
  artist: [],
  tags: [],
  characters: [],
  series: []
}

/**
 * Everything a capture's source site had. The capture links nothing but a
 * sole credited artist - which of a parent/child series pair, a base
 * character and its form, or the site's rating the user wants can't be told
 * from code - so all of it is offered here: names the library has as "add"
 * chips, names it doesn't as "create" chips, and the rating/AI flag as hints.
 */
export function useSourceSuggestions({
  metadata,
  input,
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
    if (!metadata) {
      return { existing: EMPTY_EXISTING, missing: EMPTY_MISSING, characterParents: {} }
    }
    const routed = routeSourceTags(metadata, { tags, characters, series })
    const result = matchSuggestionCandidate(
      {
        // Several credits are matched below, one chip each.
        artist: null,
        tags: routed.tags.map((name) => ({ name: cleanEntityName(name) })),
        characters: splitBooruCharacterList(routed.characters),
        series: routed.series.map((name) => ({ name: cleanEntityName(name) }))
      },
      { artists, tags, characters, series },
      danbooru
    )
    const artistMatch = matchEntityNames(
      splitArtistCredits(metadata.artist).map((name) => ({ name })),
      artists
    )
    // A series hint that names an existing series is already an "add" chip.
    const existingSeriesKeys = new Set(
      result.existing.series.map((entity) => normalizeEntityName(entity.name))
    )
    return {
      existing: { ...result.existing, artist: artistMatch.existing },
      missing: {
        ...result.missing,
        artist: artistMatch.missing,
        series: result.missing.series.filter(
          (name) => !existingSeriesKeys.has(normalizeEntityName(name))
        )
      },
      characterParents: result.characterParents
    }
  }, [metadata, artists, tags, characters, series, danbooru])

  const isDismissed = useCallback(
    (category: SuggestionCategory, name: string) => dismissed.has(`${category}:${name}`),
    [dismissed]
  )

  const missing = useMemo(() => {
    const visible = (category: SuggestionCategory): string[] =>
      matched.missing[category].filter((name) => !isDismissed(category, name))
    return {
      artist: visible('artist'),
      tags: visible('tags'),
      characters: visible('characters'),
      series: visible('series')
    }
  }, [matched, isDismissed])

  const existing = useMemo(() => {
    const selected: Record<SuggestionCategory, string[]> = {
      artist: input.artistId ? [input.artistId] : [],
      tags: input.tagIds ?? [],
      characters: input.characterIds ?? [],
      series: input.seriesIds ?? []
    }
    const visible = (category: SuggestionCategory): ExistingSuggestion[] =>
      matched.existing[category].filter(
        (entity) => !selected[category].includes(entity.id) && !isDismissed(category, entity.name)
      )
    return {
      artist: visible('artist'),
      tags: visible('tags'),
      characters: visible('characters'),
      series: visible('series')
    }
  }, [matched, isDismissed, input.artistId, input.tagIds, input.characterIds, input.seriesIds])

  const dismiss = useCallback((category: SuggestionCategory, name: string) => {
    setDismissed((prev) => new Set(prev).add(`${category}:${name}`))
  }, [])

  return {
    available: Boolean(metadata),
    site: metadata?.site,
    existing,
    missing,
    characterParents: matched.characterParents,
    suggestedSfw:
      metadata?.sfw !== undefined && metadata.sfw !== input.sfw ? metadata.sfw : undefined,
    suggestsAiGenerated:
      !input.isAiGenerated &&
      (metadata?.isAiGenerated === true || (metadata?.tags.some(isAiGeneratedTag) ?? false)),
    dismiss
  }
}
