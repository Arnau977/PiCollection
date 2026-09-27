import { useCallback, useEffect, useState } from 'react'
import { withVideoFrameFallback } from '../utils/withVideoFrameFallback'
import { fetchDanbooruCharacters } from '../utils/fetchDanbooruCharacters'
import type {
  ArtistModel,
  CharacterModel,
  MediaModel,
  SauceNaoMatch,
  SeriesModel,
  TagModel
} from '@shared/models'
import {
  EMPTY_MISSING,
  matchSuggestionCandidate,
  type ApplyPayload,
  type SuggestionCategory
} from './tagSuggestionMatching'

export type { ApplyPayload, SuggestionCategory }

interface UseSauceNaoSuggestionsArgs {
  artists: ArtistModel[]
  tags: TagModel[]
  characters: CharacterModel[]
  series: SeriesModel[]
  /** Called exactly once per successful lookup, with the IDs of entities that already exist. */
  onApplyExisting: (payload: ApplyPayload) => void
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

/** Matches `DAILY_LIMIT_ERROR_CODE` in the main process's sauceNao.service.ts. */
const DAILY_LIMIT_ERROR_CODE = 'SAUCE_NAO_DAILY_LIMIT'

interface UseSauceNaoSuggestionsResult {
  status: Status
  error: string | null
  match: SauceNaoMatch | null
  remaining: { short: number; long: number } | null
  /** Epoch ms until which searches are paused after SauceNAO's daily limit; null = allowed. */
  exhaustedUntil: number | null
  appliedCount: number
  missing: Record<SuggestionCategory, string[]>
  /** Missing character -> the base character it's a form of (see matchSuggestionCandidate). */
  characterParents: Record<string, string>
  /** `type` lets a video fall back to a frame captured here when the OS can't thumbnail it. */
  run: (route: string, type?: MediaModel['type']) => Promise<void>
  dismiss: (category: SuggestionCategory, name: string) => void
  reset: () => void
}

export function useSauceNaoSuggestions({
  artists,
  tags,
  characters,
  series,
  onApplyExisting
}: UseSauceNaoSuggestionsArgs): UseSauceNaoSuggestionsResult {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [match, setMatch] = useState<SauceNaoMatch | null>(null)
  const [remaining, setRemaining] = useState<{ short: number; long: number } | null>(null)
  const [exhaustedUntil, setExhaustedUntil] = useState<number | null>(null)
  const [appliedCount, setAppliedCount] = useState(0)
  const [characterParents, setCharacterParents] = useState<Record<string, string>>({})
  const [missing, setMissing] = useState<Record<SuggestionCategory, string[]>>(EMPTY_MISSING)

  // The pause lives in the main process, so it survives closing this form.
  const refreshQuota = useCallback(async () => {
    const result = await window.api.sauceNao.getQuota()
    if (result.success) setExhaustedUntil(result.data.exhaustedUntil)
  }, [])

  useEffect(() => {
    void refreshQuota()
  }, [refreshQuota])

  useEffect(() => {
    if (exhaustedUntil === null) return
    const timer = setTimeout(
      () => setExhaustedUntil(null),
      Math.max(0, exhaustedUntil - Date.now())
    )
    return (): void => clearTimeout(timer)
  }, [exhaustedUntil])

  // Matching happens once, right here, using whatever entity lists were
  // passed in at the moment the lookup resolves - a snapshot of what was on
  // screen when the button was pressed. It is NOT recomputed reactively off
  // a later re-render, so a background refetch of the entity lists can't
  // make an applied/missing chip flicker away mid-interaction.
  const run = useCallback(
    async (route: string, type?: MediaModel['type']) => {
      if (status === 'loading') return
      setStatus('loading')
      setError(null)

      const result = await withVideoFrameFallback(route, type, () =>
        window.api.sauceNao.lookup(route)
      )
      void refreshQuota()
      if (!result.success) {
        // The disabled button's tooltip explains this one - no inline error.
        if (result.error.code === DAILY_LIMIT_ERROR_CODE) {
          setStatus('idle')
          return
        }
        setStatus('error')
        setError(result.error.message)
        return
      }

      setRemaining(result.data.remaining)

      if (!result.data.match) {
        setMatch(null)
        setMissing(EMPTY_MISSING)
        setAppliedCount(0)
        setStatus('ready')
        return
      }

      const found = result.data.match
      setMatch(found)

      const danbooru = await fetchDanbooruCharacters(found.characters.map((c) => c.name))
      const matched = matchSuggestionCandidate(
        found,
        { artists, tags, characters, series },
        danbooru
      )
      onApplyExisting({ ...matched.applied, sourceUrl: found.sourceUrl })
      setMissing(matched.missing)
      setCharacterParents(matched.characterParents)
      setAppliedCount(matched.appliedCount)
      setStatus('ready')
    },
    [status, artists, tags, characters, series, onApplyExisting, refreshQuota]
  )

  const dismiss = useCallback((category: SuggestionCategory, name: string) => {
    setMissing((prev) => ({
      ...prev,
      [category]: prev[category].filter((entry) => entry !== name)
    }))
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setMatch(null)
    setRemaining(null)
    setAppliedCount(0)
    setMissing(EMPTY_MISSING)
    setCharacterParents({})
  }, [])

  return {
    characterParents,
    status,
    error,
    match,
    remaining,
    exhaustedUntil,
    appliedCount,
    missing,
    run,
    dismiss,
    reset
  }
}
