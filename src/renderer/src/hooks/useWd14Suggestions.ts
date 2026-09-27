import { useCallback, useState } from 'react'
import { withVideoFrameFallback } from '../utils/withVideoFrameFallback'
import type {
  CharacterModel,
  MediaModel,
  SeriesModel,
  TagModel,
  Wd14TagSuggestion
} from '@shared/models'
import { normalizeForMatch } from '../utils/fuzzyMatch'
import { normalizeEntityName } from '../utils/matchEntityNames'
import {
  matchSuggestionCandidate,
  type ApplyPayload,
  type SuggestionCategory
} from './tagSuggestionMatching'

type Status = 'idle' | 'loading' | 'ready' | 'error'

export interface Wd14MissingSuggestion {
  name: string
  score: number
}

const EMPTY_WD14_MISSING: Record<SuggestionCategory, Wd14MissingSuggestion[]> = {
  artist: [],
  tags: [],
  characters: [],
  series: []
}

interface UseWd14SuggestionsArgs {
  tags: TagModel[]
  characters: CharacterModel[]
  series: SeriesModel[]
  /** Called exactly once per successful lookup, with the IDs of entities that already exist. */
  onApplyExisting: (payload: ApplyPayload) => void
}

interface UseWd14SuggestionsResult {
  status: Status
  error: string | null
  appliedCount: number
  missing: Record<SuggestionCategory, Wd14MissingSuggestion[]>
  /** Missing character -> the base character it's a form of (see matchSuggestionCandidate). */
  characterParents: Record<string, string>
  /** The model's single highest-scoring rating prediction, or null before a run/on error. */
  rating: Wd14TagSuggestion | null
  /** `type` lets a video fall back to a frame captured here when the OS can't thumbnail it. */
  run: (route: string, type?: MediaModel['type']) => Promise<void>
  dismiss: (category: SuggestionCategory, name: string) => void
  reset: () => void
}

function byCategory(
  tags: Wd14TagSuggestion[],
  category: Wd14TagSuggestion['category']
): Wd14TagSuggestion[] {
  return tags.filter((tag) => tag.category === category)
}

/** `matchSuggestionCandidate` capitalizes missing character/series names but leaves tags
 * lowercase, so a plain name->score map (keyed by the model's raw lowercase output) would miss
 * on lookup for those two categories - normalize both sides instead of relying on exact case. */
function withScores(names: string[], scoreByName: Map<string, number>): Wd14MissingSuggestion[] {
  return names
    .map((name) => ({ name, score: scoreByName.get(normalizeEntityName(name)) ?? 0 }))
    .sort((a, b) => b.score - a.score)
}

/**
 * A missing character's name no longer equals its tag once qualifiers are
 * sorted out ("Pyra (Pro Swimmer)" from "pyra (pro swimmer) (xenoblade)"),
 * so score it by the tag containing all of its words.
 */
function withCharacterScores(
  names: string[],
  characterTags: Wd14TagSuggestion[]
): Wd14MissingSuggestion[] {
  return names
    .map((name) => {
      const words = normalizeForMatch(name).split(' ')
      const tag = characterTags.find((candidate) => {
        const tagWords = new Set(normalizeForMatch(candidate.name).split(' '))
        return words.every((word) => tagWords.has(word))
      })
      return { name, score: tag?.score ?? 0 }
    })
    .sort((a, b) => b.score - a.score)
}

export function useWd14Suggestions({
  tags,
  characters,
  series,
  onApplyExisting
}: UseWd14SuggestionsArgs): UseWd14SuggestionsResult {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [appliedCount, setAppliedCount] = useState(0)
  const [characterParents, setCharacterParents] = useState<Record<string, string>>({})
  const [missing, setMissing] =
    useState<Record<SuggestionCategory, Wd14MissingSuggestion[]>>(EMPTY_WD14_MISSING)
  const [rating, setRating] = useState<Wd14TagSuggestion | null>(null)

  const run = useCallback(
    async (route: string, type?: MediaModel['type']) => {
      if (status === 'loading') return
      setStatus('loading')
      setError(null)

      const result = await withVideoFrameFallback(route, type, () =>
        window.api.wd14Tagger.suggestTags(route)
      )
      if (!result.success) {
        setStatus('error')
        setError(result.error.message)
        return
      }

      const copyrightTags = byCategory(result.data, 'copyright')
      // Full tags, e.g. "seele (honkai: star rail)" - matchSuggestionCandidate
      // sorts their qualifiers into series and forms (resolveCharacterCandidates).
      const characterTags = byCategory(result.data, 'character')

      const scoreByName = new Map([
        ...byCategory(result.data, 'general').map(
          (tag) => [normalizeEntityName(tag.name), tag.score] as const
        ),
        ...copyrightTags.map((tag) => [normalizeEntityName(tag.name), tag.score] as const)
      ])
      // The model's own copyright guess (plus any series peeled off a
      // character tag) doubles as series context for disambiguating a
      // same-named character, the same role SauceNAO's series
      // play in matchSuggestionCandidate.
      const matched = matchSuggestionCandidate(
        {
          artist: null,
          tags: byCategory(result.data, 'general'),
          characters: characterTags,
          series: copyrightTags
        },
        { artists: [], tags, characters, series }
      )

      onApplyExisting(matched.applied)
      setMissing({
        artist: [],
        tags: withScores(matched.missing.tags, scoreByName),
        characters: withCharacterScores(matched.missing.characters, characterTags),
        series: withScores(matched.missing.series, scoreByName)
      })
      setAppliedCount(matched.appliedCount)
      setCharacterParents(matched.characterParents)
      // Only category the python script ever guarantees at most one of - no
      // need to pick a "best" one, but guard against future changes anyway.
      const ratingTags = byCategory(result.data, 'rating')
      setRating(
        ratingTags.reduce<Wd14TagSuggestion | null>(
          (best, tag) => (!best || tag.score > best.score ? tag : best),
          null
        )
      )
      setStatus('ready')
    },
    [status, tags, characters, series, onApplyExisting]
  )

  const dismiss = useCallback((category: SuggestionCategory, name: string) => {
    setMissing((prev) => ({
      ...prev,
      [category]: prev[category].filter((entry) => entry.name !== name)
    }))
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setAppliedCount(0)
    setMissing(EMPTY_WD14_MISSING)
    setCharacterParents({})
    setRating(null)
  }, [])

  return { status, error, appliedCount, missing, characterParents, rating, run, dismiss, reset }
}
