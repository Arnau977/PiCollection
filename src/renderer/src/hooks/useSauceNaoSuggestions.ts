import { useCallback, useEffect, useState, type RefObject } from 'react'
import { shownFrameBytes, withVideoFrameFallback } from '../utils/withVideoFrameFallback'
import type { VideoFrameSource } from '../components/VideoPlayer/videoFrame'
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
  type HeldCharacter,
  type SuggestionCategory
} from './tagSuggestionMatching'

export type { ApplyPayload, SuggestionCategory }

interface UseSauceNaoSuggestionsArgs {
  artists: ArtistModel[]
  tags: TagModel[]
  characters: CharacterModel[]
  series: SeriesModel[]
  /**
   * Called once per accepted match (on its own at AUTO_APPLY_SIMILARITY and
   * up, otherwise on accept), with the IDs of entities that already exist.
   */
  onApplyExisting: (payload: ApplyPayload) => void
  /** "Not this one" on an applied match: take back what onApplyExisting added. */
  onRevertApplied?: () => void
  /** The edit form's video preview: a video is searched by the frame it shows. */
  videoFrame?: RefObject<VideoFrameSource | null>
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

/**
 * A match this similar is applied on its own (with "Not this one" to take
 * it back); below it waits for Accept / Reject. Wrong matches - a different
 * drawing whose artist, URL, series and characters then had to be removed
 * by hand - come in under it.
 */
export const AUTO_APPLY_SIMILARITY = 90

/** Whether the shown match was applied, or still waits for the user. */
export type MatchDecision = 'applied' | 'held'

type Matched = ReturnType<typeof matchSuggestionCandidate>

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
  /** Recognized characters others are inspired by, left for the user to pick (see matchSuggestionCandidate). */
  held: HeldCharacter[]
  /** Drops a held character once the user has picked. */
  resolveHeld: (originalId: string) => void
  decision: MatchDecision | null
  /** Applies a held match. */
  accept: () => void
  /** Drops the match; an applied one is taken back first (onRevertApplied). */
  reject: () => void
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
  onApplyExisting,
  onRevertApplied,
  videoFrame
}: UseSauceNaoSuggestionsArgs): UseSauceNaoSuggestionsResult {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [match, setMatch] = useState<SauceNaoMatch | null>(null)
  const [remaining, setRemaining] = useState<{ short: number; long: number } | null>(null)
  const [exhaustedUntil, setExhaustedUntil] = useState<number | null>(null)
  const [appliedCount, setAppliedCount] = useState(0)
  const [characterParents, setCharacterParents] = useState<Record<string, string>>({})
  const [held, setHeld] = useState<HeldCharacter[]>([])
  const [missing, setMissing] = useState<Record<SuggestionCategory, string[]>>(EMPTY_MISSING)
  const [decision, setDecision] = useState<MatchDecision | null>(null)
  const [heldMatch, setHeldMatch] = useState<{ matched: Matched; sourceUrl?: string } | null>(null)

  const applyMatched = useCallback(
    (matched: Matched, sourceUrl?: string) => {
      onApplyExisting({ ...matched.applied, sourceUrl })
      setMissing(matched.missing)
      setCharacterParents(matched.characterParents)
      setHeld(matched.held)
      setAppliedCount(matched.appliedCount)
      setHeldMatch(null)
      setDecision('applied')
    },
    [onApplyExisting]
  )

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

      const frame = await shownFrameBytes(type, videoFrame)
      const result = frame
        ? await window.api.sauceNao.lookupImage(frame)
        : await withVideoFrameFallback(route, type, () => window.api.sauceNao.lookup(route))
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

      setDecision(null)
      setHeldMatch(null)
      if (!result.data.match) {
        setMatch(null)
        setMissing(EMPTY_MISSING)
        setHeld([])
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
      if (found.similarity >= AUTO_APPLY_SIMILARITY) {
        applyMatched(matched, found.sourceUrl)
      } else {
        setMissing(EMPTY_MISSING)
        setHeld([])
        setAppliedCount(0)
        setHeldMatch({ matched, sourceUrl: found.sourceUrl })
        setDecision('held')
      }
      setStatus('ready')
    },
    [status, artists, tags, characters, series, applyMatched, refreshQuota, videoFrame]
  )

  const accept = useCallback(() => {
    if (heldMatch) applyMatched(heldMatch.matched, heldMatch.sourceUrl)
  }, [heldMatch, applyMatched])

  const dismiss = useCallback((category: SuggestionCategory, name: string) => {
    setMissing((prev) => ({
      ...prev,
      [category]: prev[category].filter((entry) => entry !== name)
    }))
  }, [])

  const resolveHeld = useCallback((originalId: string) => {
    setHeld((prev) => prev.filter((entry) => entry.original.id !== originalId))
  }, [])

  const reset = useCallback(() => {
    setDecision(null)
    setHeldMatch(null)
    setStatus('idle')
    setError(null)
    setMatch(null)
    setRemaining(null)
    setAppliedCount(0)
    setMissing(EMPTY_MISSING)
    setCharacterParents({})
    setHeld([])
  }, [])

  const reject = useCallback(() => {
    if (decision === 'applied') onRevertApplied?.()
    const left = remaining
    reset()
    // The quota line stays: rejecting a match doesn't give a search back.
    setRemaining(left)
  }, [decision, onRevertApplied, remaining, reset])

  return {
    decision,
    accept,
    reject,
    characterParents,
    held,
    resolveHeld,
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
