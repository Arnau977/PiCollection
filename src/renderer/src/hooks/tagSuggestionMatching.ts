import type {
  ArtistModel,
  CharacterModel,
  SauceNaoName,
  SeriesModel,
  TagModel
} from '@shared/models'
import {
  capitalizeFirstLetter,
  matchCharacterNames,
  matchEntityNames,
  normalizeEntityName
} from '../utils/matchEntityNames'

export type SuggestionCategory = 'artist' | 'tags' | 'characters' | 'series'

export interface ApplyPayload {
  artistId?: string
  tagIds: string[]
  characterIds: string[]
  seriesIds: string[]
}

/** The shape any tag-suggestion source (SauceNAO, WD14, ...) must produce to be matched against the library's existing entities. */
export interface TagSuggestionCandidate {
  artist: SauceNaoName | null
  tags: SauceNaoName[]
  characters: SauceNaoName[]
  series: SauceNaoName[]
  seriesHints: SauceNaoName[]
}

export interface MatchedSuggestions {
  applied: ApplyPayload
  missing: Record<SuggestionCategory, string[]>
  appliedCount: number
}

export const EMPTY_MISSING: Record<SuggestionCategory, string[]> = {
  artist: [],
  tags: [],
  characters: [],
  series: []
}

interface MatchEntities {
  artists: ArtistModel[]
  tags: TagModel[]
  characters: CharacterModel[]
  series: SeriesModel[]
}

/**
 * Series and characters can each form a parent/child hierarchy (e.g. Nintendo
 * > Fire Emblem > Fire Emblem Heroes). When a suggestion source matches
 * several entities from the same ancestry chain, only the most specific
 * (leaf) one is useful to apply - its ancestors are implied by the app's
 * series-closure matching elsewhere, so auto-adding them too is just noise.
 */
function pruneAncestors<T extends { id: string; parentId?: string | null }>(
  matched: T[],
  all: T[]
): T[] {
  const byId = new Map(all.map((entity) => [entity.id, entity]))
  function isDescendantOf(id: string, ancestorId: string): boolean {
    let current = byId.get(id)
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true
      current = byId.get(current.parentId)
    }
    return false
  }
  return matched.filter(
    (entity) =>
      !matched.some((other) => other.id !== entity.id && isDescendantOf(other.id, entity.id))
  )
}

export function matchSuggestionCandidate(
  candidate: TagSuggestionCandidate,
  entities: MatchEntities
): MatchedSuggestions {
  const artistMatch = candidate.artist
    ? matchEntityNames([candidate.artist], entities.artists)
    : { existing: [], missing: [] }
  const tagsMatch = matchEntityNames(candidate.tags, entities.tags)
  const seriesContext = [...candidate.series, ...candidate.seriesHints].map((s) =>
    normalizeEntityName(s.name)
  )
  const charactersMatch = matchCharacterNames(
    candidate.characters,
    entities.characters,
    seriesContext
  )
  // `series` comes straight from the source's own series field - trustworthy
  // enough to apply on an existing-entity match with no further review.
  // `seriesHints` are a heuristic (a qualifier peeled off a character name,
  // e.g. "Fate" from "Ishtar (Fate)") that's usually the series but isn't
  // guaranteed to be, so even when one happens to match an existing series
  // by name, it's surfaced as a chip to confirm rather than applied silently.
  const seriesMatch = matchEntityNames(candidate.series, entities.series)
  const seriesHintsMatch = matchEntityNames(candidate.seriesHints, entities.series)
  const seriesHintNames = [
    ...seriesHintsMatch.existing.map((entity) => entity.name),
    ...seriesHintsMatch.missing
  ]
  const leafCharacters = pruneAncestors(charactersMatch.existing, entities.characters)
  const leafSeries = pruneAncestors(seriesMatch.existing, entities.series)

  return {
    applied: {
      artistId: artistMatch.existing[0]?.id,
      tagIds: tagsMatch.existing.map((entity) => entity.id),
      characterIds: leafCharacters.map((entity) => entity.id),
      seriesIds: leafSeries.map((entity) => entity.id)
    },
    missing: {
      artist: artistMatch.missing,
      // Booru-sourced names arrive lowercase; characters and series read
      // oddly that way, so capitalize before they're shown or created.
      tags: tagsMatch.missing,
      characters: charactersMatch.missing.map(capitalizeFirstLetter),
      series: [...seriesMatch.missing, ...seriesHintNames].map(capitalizeFirstLetter)
    },
    appliedCount:
      (artistMatch.existing.length > 0 ? 1 : 0) +
      tagsMatch.existing.length +
      leafCharacters.length +
      leafSeries.length
  }
}
