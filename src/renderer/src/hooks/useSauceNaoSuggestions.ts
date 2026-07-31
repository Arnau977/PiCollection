import { useCallback, useState } from 'react'
import type {
  ArtistModel,
  CharacterModel,
  SauceNaoMatch,
  SeriesModel,
  TagModel
} from '@shared/models'
import { capitalizeFirstLetter, matchEntityNames } from '../utils/matchEntityNames'

export type SuggestionCategory = 'artist' | 'tags' | 'characters' | 'series'

export interface ApplyPayload {
  artistId?: string
  tagIds: string[]
  characterIds: string[]
  seriesIds: string[]
}

interface UseSauceNaoSuggestionsArgs {
  artists: ArtistModel[]
  tags: TagModel[]
  characters: CharacterModel[]
  series: SeriesModel[]
  /** Called exactly once per successful lookup, with the IDs of entities that already exist. */
  onApplyExisting: (payload: ApplyPayload) => void
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface UseSauceNaoSuggestionsResult {
  status: Status
  error: string | null
  match: SauceNaoMatch | null
  remaining: { short: number; long: number } | null
  appliedCount: number
  missing: Record<SuggestionCategory, string[]>
  run: (route: string) => Promise<void>
  dismiss: (category: SuggestionCategory, name: string) => void
  reset: () => void
}

const EMPTY_MISSING: Record<SuggestionCategory, string[]> = {
  artist: [],
  tags: [],
  characters: [],
  series: []
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
  const [appliedCount, setAppliedCount] = useState(0)
  const [missing, setMissing] = useState<Record<SuggestionCategory, string[]>>(EMPTY_MISSING)

  // Matching happens once, right here, using whatever entity lists were
  // passed in at the moment the lookup resolves - a snapshot of what was on
  // screen when the button was pressed. It is NOT recomputed reactively off
  // a later re-render, so a background refetch of the entity lists can't
  // make an applied/missing chip flicker away mid-interaction.
  const run = useCallback(
    async (route: string) => {
      if (status === 'loading') return
      setStatus('loading')
      setError(null)

      const result = await window.api.sauceNao.lookup(route)
      if (!result.success) {
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

      const artistMatch = found.artist
        ? matchEntityNames([found.artist], artists)
        : { existing: [], missing: [] }
      const tagsMatch = matchEntityNames(found.tags, tags)
      const charactersMatch = matchEntityNames(found.characters, characters)
      const seriesMatch = matchEntityNames([...found.series, ...found.seriesHints], series)

      onApplyExisting({
        artistId: artistMatch.existing[0]?.id,
        tagIds: tagsMatch.existing.map((entity) => entity.id),
        characterIds: charactersMatch.existing.map((entity) => entity.id),
        seriesIds: seriesMatch.existing.map((entity) => entity.id)
      })

      setMissing({
        artist: artistMatch.missing,
        tags: tagsMatch.missing,
        // Booru-sourced names arrive lowercase; characters and series read
        // oddly that way, so capitalize before they're shown or created.
        characters: charactersMatch.missing.map(capitalizeFirstLetter),
        series: seriesMatch.missing.map(capitalizeFirstLetter)
      })
      setAppliedCount(
        (artistMatch.existing.length > 0 ? 1 : 0) +
          tagsMatch.existing.length +
          charactersMatch.existing.length +
          seriesMatch.existing.length
      )
      setStatus('ready')
    },
    [status, artists, tags, characters, series, onApplyExisting]
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
  }, [])

  return { status, error, match, remaining, appliedCount, missing, run, dismiss, reset }
}
