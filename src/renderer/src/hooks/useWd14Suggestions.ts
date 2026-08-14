import { useCallback, useState } from 'react'
import type {
  CharacterModel,
  SauceNaoName,
  SeriesModel,
  TagModel,
  Wd14TagSuggestion
} from '@shared/models'
import { splitBooruListWithQualifiers } from '@shared/utils'
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
  run: (route: string) => Promise<void>
  dismiss: (category: SuggestionCategory, name: string) => void
  reset: () => void
}

function byCategory(
  tags: Wd14TagSuggestion[],
  category: Wd14TagSuggestion['category']
): Wd14TagSuggestion[] {
  return tags.filter((tag) => tag.category === category)
}

interface SplitCharacterTag {
  name: SauceNaoName
  qualifier: SauceNaoName | null
  score: number
}

/**
 * Unlike SauceNAO (which reports a character's series separately), the WD14
 * label set bakes a disambiguating series straight into the character tag's
 * own name - e.g. "seele (honkai: star rail)" as one Danbooru tag. Matching
 * that raw string against the library's "Seele" would never hit, silently
 * treating an already-known character as brand new every time. Peel the
 * qualifier off first, exactly like SauceNAO's own character field.
 */
function splitCharacterTag(tag: Wd14TagSuggestion): SplitCharacterTag {
  const { names, qualifiers } = splitBooruListWithQualifiers(tag.name)
  return {
    name: names[0] ?? { name: tag.name },
    qualifier: qualifiers[0] ?? null,
    score: tag.score
  }
}

/** `matchSuggestionCandidate` capitalizes missing character/series names but leaves tags
 * lowercase, so a plain name->score map (keyed by the model's raw lowercase output) would miss
 * on lookup for those two categories - normalize both sides instead of relying on exact case. */
function withScores(names: string[], scoreByName: Map<string, number>): Wd14MissingSuggestion[] {
  return names
    .map((name) => ({ name, score: scoreByName.get(normalizeEntityName(name)) ?? 0 }))
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
  const [missing, setMissing] =
    useState<Record<SuggestionCategory, Wd14MissingSuggestion[]>>(EMPTY_WD14_MISSING)

  const run = useCallback(
    async (route: string) => {
      if (status === 'loading') return
      setStatus('loading')
      setError(null)

      const result = await window.api.wd14Tagger.suggestTags(route)
      if (!result.success) {
        setStatus('error')
        setError(result.error.message)
        return
      }

      const copyrightTags = byCategory(result.data, 'copyright')
      const characterTags = byCategory(result.data, 'character').map(splitCharacterTag)
      const copyrightKeys = new Set(copyrightTags.map((tag) => normalizeEntityName(tag.name)))
      // Same rule as SauceNAO's own seriesHints: a qualifier that just
      // repeats a series the model already reported directly (via the
      // copyright category) doesn't need a second, redundant suggestion.
      const seriesHints = characterTags
        .map((entry) => entry.qualifier)
        .filter((hint): hint is SauceNaoName => {
          if (!hint) return false
          return !copyrightKeys.has(normalizeEntityName(hint.name))
        })

      const scoreByName = new Map([
        ...byCategory(result.data, 'general').map(
          (tag) => [normalizeEntityName(tag.name), tag.score] as const
        ),
        ...characterTags.map(
          (entry) => [normalizeEntityName(entry.name.name), entry.score] as const
        ),
        ...characterTags
          .filter((entry) => entry.qualifier)
          .map((entry) => [normalizeEntityName(entry.qualifier!.name), entry.score] as const),
        ...copyrightTags.map((tag) => [normalizeEntityName(tag.name), tag.score] as const)
      ])
      // The model's own copyright guess (plus any series peeled off a
      // character tag) doubles as series context for disambiguating a
      // same-named character, the same role SauceNAO's series/seriesHints
      // play in matchSuggestionCandidate.
      const matched = matchSuggestionCandidate(
        {
          artist: null,
          tags: byCategory(result.data, 'general'),
          characters: characterTags.map((entry) => entry.name),
          series: copyrightTags,
          seriesHints
        },
        { artists: [], tags, characters, series }
      )

      onApplyExisting(matched.applied)
      setMissing({
        artist: [],
        tags: withScores(matched.missing.tags, scoreByName),
        characters: withScores(matched.missing.characters, scoreByName),
        series: withScores(matched.missing.series, scoreByName)
      })
      setAppliedCount(matched.appliedCount)
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
  }, [])

  return { status, error, appliedCount, missing, run, dismiss, reset }
}
