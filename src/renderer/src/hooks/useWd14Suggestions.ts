import { useCallback, useState } from 'react'
import type { TagModel } from '@shared/models'
import { matchEntityNames } from '../utils/matchEntityNames'

type Status = 'idle' | 'loading' | 'ready' | 'error'

export interface Wd14MissingSuggestion {
  name: string
  score: number
}

interface UseWd14SuggestionsArgs {
  tags: TagModel[]
  /** Called exactly once per successful lookup, with the IDs of tags that already exist. */
  onApplyExisting: (tagIds: string[]) => void
}

interface UseWd14SuggestionsResult {
  status: Status
  error: string | null
  appliedCount: number
  missing: Wd14MissingSuggestion[]
  run: (route: string) => Promise<void>
  dismiss: (name: string) => void
  reset: () => void
}

export function useWd14Suggestions({
  tags,
  onApplyExisting
}: UseWd14SuggestionsArgs): UseWd14SuggestionsResult {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [appliedCount, setAppliedCount] = useState(0)
  const [missing, setMissing] = useState<Wd14MissingSuggestion[]>([])

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

      const scoreByName = new Map(result.data.map((tag) => [tag.name, tag.score]))
      const matched = matchEntityNames(result.data, tags)

      onApplyExisting(matched.existing.map((entity) => entity.id))
      setMissing(
        matched.missing
          .map((name) => ({ name, score: scoreByName.get(name) ?? 0 }))
          .sort((a, b) => b.score - a.score)
      )
      setAppliedCount(matched.existing.length)
      setStatus('ready')
    },
    [status, tags, onApplyExisting]
  )

  const dismiss = useCallback((name: string) => {
    setMissing((prev) => prev.filter((entry) => entry.name !== name))
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setAppliedCount(0)
    setMissing([])
  }, [])

  return { status, error, appliedCount, missing, run, dismiss, reset }
}
