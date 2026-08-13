import { useEffect, useState } from 'react'
import type { MediaDuplicateMatch } from '@shared/models'

interface SimilarMediaState {
  data: MediaDuplicateMatch[]
  loading: boolean
  error: string | null
}

export function useSimilarMedia(mediaId: string): SimilarMediaState {
  const [state, setState] = useState<SimilarMediaState>({ data: [], loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))

    window.api.media.findSimilar(mediaId).then((result) => {
      if (cancelled) return
      setState(
        result.success
          ? { data: result.data, loading: false, error: null }
          : { data: [], loading: false, error: result.error.message }
      )
    })

    return (): void => {
      cancelled = true
    }
  }, [mediaId])

  return state
}
