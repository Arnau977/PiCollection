import { useCallback, useEffect, useState } from 'react'
import type { MediaModel } from '@shared/models'

interface MediaByIdState {
  data: MediaModel | null
  loading: boolean
  error: string | null
}

export function useMediaById(id: string | undefined): MediaByIdState & { refetch: () => void } {
  const [state, setState] = useState<MediaByIdState>({ data: null, loading: true, error: null })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: null })
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))

    window.api.media.getById(id).then((result) => {
      if (cancelled) return
      setState(
        result.success
          ? { data: result.data, loading: false, error: null }
          : { data: null, loading: false, error: result.error.message }
      )
    })

    return (): void => {
      cancelled = true
    }
  }, [id, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  return { ...state, refetch }
}
