import type {
  ArtistModel,
  CharacterModel,
  DanbooruCharacterInfo,
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
import { resolveCharacterCandidates } from './resolveCharacterCandidates'

export type SuggestionCategory = 'artist' | 'tags' | 'characters' | 'series'

export interface ApplyPayload {
  artistId?: string
  /** The matched post's URL (SauceNAO only) - fills the source URL field only while it's empty. */
  sourceUrl?: string
  tagIds: string[]
  characterIds: string[]
  seriesIds: string[]
}

/** The shape any tag-suggestion source (SauceNAO, WD14, ...) must produce to be matched against the library's existing entities. */
export interface TagSuggestionCandidate {
  artist: SauceNaoName | null
  tags: SauceNaoName[]
  /** As the source reports them - trailing "(...)" qualifiers are sorted into series/forms here. */
  characters: SauceNaoName[]
  series: SauceNaoName[]
}

export interface MatchedSuggestions {
  applied: ApplyPayload
  missing: Record<SuggestionCategory, string[]>
  /** Missing character name -> the base character it's a form of ("Pyra (Pro Swimmer)" -> "Pyra"). */
  characterParents: Record<string, string>
  appliedCount: number
  /**
   * Every library entity the candidate matched, before the ancestor pruning
   * `applied` does - for sources that only suggest (the extension's source
   * site), where the user picks which of a parent/child pair they want.
   */
  existing: Record<SuggestionCategory, { id: string; name: string }[]>
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

function uniqueById<T extends { id: string }>(entities: T[]): T[] {
  return Array.from(new Map(entities.map((entity) => [entity.id, entity])).values())
}

export function matchSuggestionCandidate(
  candidate: TagSuggestionCandidate,
  entities: MatchEntities,
  /** Danbooru's answers for the candidate's character tags, when available. */
  danbooru: DanbooruCharacterInfo[] = []
): MatchedSuggestions {
  const artistMatch = candidate.artist
    ? matchEntityNames([candidate.artist], entities.artists)
    : { existing: [], missing: [] }
  const tagsMatch = matchEntityNames(candidate.tags, entities.tags)
  const resolvedCharacters = resolveCharacterCandidates(
    candidate.characters,
    candidate.series,
    entities.series,
    danbooru
  )
  // Danbooru-confirmed series are as trustworthy as the source's own series field.
  const confirmedSeries = [
    ...candidate.series,
    ...resolvedCharacters.series.filter(
      (s) =>
        !candidate.series.some(
          (own) => normalizeEntityName(own.name) === normalizeEntityName(s.name)
        )
    )
  ]
  const seriesContext = [...confirmedSeries, ...resolvedCharacters.seriesHints].map((s) =>
    normalizeEntityName(s.name)
  )
  const charactersMatch = matchCharacterNames(
    resolvedCharacters.characters.filter((character) => !character.parent),
    entities.characters,
    seriesContext
  )
  // A form/costume ("Pyra (Pro Swimmer)") is applied if it already exists.
  // Otherwise its base character is applied right away when that exists, and
  // the form is offered as a chip that creates it as the base's child.
  const characterParents: Record<string, string> = {}
  for (const form of resolvedCharacters.characters) {
    if (!form.parent) continue
    const formMatch = matchCharacterNames([form], entities.characters, seriesContext)
    if (formMatch.existing.length > 0) {
      charactersMatch.existing.push(...formMatch.existing)
      continue
    }
    const parentMatch = matchCharacterNames([form.parent], entities.characters, seriesContext)
    charactersMatch.existing.push(...parentMatch.existing)
    charactersMatch.missing.push(...formMatch.missing)
    characterParents[capitalizeFirstLetter(form.name)] =
      parentMatch.existing[0]?.name ?? form.parent.name
  }
  // `series` comes straight from the source's own series field - trustworthy
  // enough to apply on an existing-entity match with no further review.
  // `seriesHints` are a heuristic (a qualifier peeled off a character name,
  // e.g. "Fate" from "Ishtar (Fate)") that's usually the series but isn't
  // guaranteed to be, so even when one happens to match an existing series
  // by name, it's surfaced as a chip to confirm rather than applied silently.
  const seriesMatch = matchEntityNames(confirmedSeries, entities.series)
  const seriesHintsMatch = matchEntityNames(resolvedCharacters.seriesHints, entities.series)
  const leafCharacters = pruneAncestors(uniqueById(charactersMatch.existing), entities.characters)
  const leafSeries = pruneAncestors(seriesMatch.existing, entities.series)
  // A matched character with exactly one associated series gets that series
  // silently linked elsewhere (see withImpliedSeries) - if a hint happens to
  // name that same series, surfacing it again as a "confirm this" chip would
  // just duplicate what's already been applied.
  const impliedSeriesIds = new Set(
    leafCharacters.flatMap((character) =>
      character.series.length === 1 ? [character.series[0].id] : []
    )
  )
  const seriesHintNames = [
    ...seriesHintsMatch.existing
      .filter((entity) => !impliedSeriesIds.has(entity.id))
      .map((entity) => entity.name),
    ...seriesHintsMatch.missing
  ]

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
    characterParents,
    existing: {
      artist: artistMatch.existing,
      tags: tagsMatch.existing,
      characters: uniqueById(charactersMatch.existing),
      series: uniqueById([...seriesMatch.existing, ...seriesHintsMatch.existing])
    },
    appliedCount:
      (artistMatch.existing.length > 0 ? 1 : 0) +
      tagsMatch.existing.length +
      leafCharacters.length +
      leafSeries.length
  }
}
