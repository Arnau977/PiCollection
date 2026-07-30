import { useEffect, useState } from 'react'
import type { MediaFilters, MediaModel, Sorting } from '@shared/models'

interface MediaQueryState {
  data: MediaModel[]
  total: number
  loading: boolean
  error: string | null
}

const INITIAL_STATE: MediaQueryState = { data: [], total: 0, loading: true, error: null }

export function useMediaQuery(filters: MediaFilters, sorting?: Sorting): MediaQueryState {
  const [state, setState] = useState<MediaQueryState>(INITIAL_STATE)

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
  }, [filters, sorting])

  return state
}
