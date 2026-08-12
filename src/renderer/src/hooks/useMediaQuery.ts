import { useCallback, useEffect, useState } from 'react'
import type { MediaFilters, MediaModel, Sorting } from '@shared/models'

interface MediaQueryState {
  data: MediaModel[]
  total: number
  loading: boolean
  error: string | null
}

interface MediaQueryResult extends MediaQueryState {
  refetch: () => void
}

const INITIAL_STATE: MediaQueryState = { data: [], total: 0, loading: true, error: null }

export function useMediaQuery(filters: MediaFilters, sorting?: Sorting): MediaQueryResult {
  const [state, setState] = useState<MediaQueryState>(INITIAL_STATE)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))

    window.api.media.getFiltered(filters, sorting).then((result) => {
      if (cancelled) return
      setState(
        result.success
          ? { data: result.data.items, total: result.data.total, loading: false, error: null }
          : { data: [], total: 0, loading: false, error: result.error.message }
      )
    })

    return (): void => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadToken is a deliberate
    // manual-refetch trigger, not a dependency the effect reads
  }, [filters, sorting, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  return { ...state, refetch }
}
