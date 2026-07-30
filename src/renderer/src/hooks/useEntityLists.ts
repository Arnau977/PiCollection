import { useCallback, useEffect, useState } from 'react'
import type { ArtistModel, CharacterModel, SeriesModel, TagModel } from '@shared/models'

interface ListState<T> {
  data: T[]
  loading: boolean
  error: string | null
}

type ListHookResult<T> = ListState<T> & { refetch: () => void }

const INITIAL_STATE = { data: [], loading: true, error: null }

export function useArtists(): ListHookResult<ArtistModel> {
  const [state, setState] = useState<ListState<ArtistModel>>(INITIAL_STATE)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))
    window.api.artist.getAll().then((result) => {
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
  }, [reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  return { ...state, refetch }
}

export function useTags(): ListHookResult<TagModel> {
  const [state, setState] = useState<ListState<TagModel>>(INITIAL_STATE)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))
    window.api.tag.getAll().then((result) => {
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
  }, [reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  return { ...state, refetch }
}

export function useCharacters(): ListHookResult<CharacterModel> {
  const [state, setState] = useState<ListState<CharacterModel>>(INITIAL_STATE)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))
    window.api.character.getAll().then((result) => {
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
  }, [reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  return { ...state, refetch }
}

export function useSeries(): ListHookResult<SeriesModel> {
  const [state, setState] = useState<ListState<SeriesModel>>(INITIAL_STATE)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))
    window.api.series.getAll().then((result) => {
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
  }, [reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  return { ...state, refetch }
}
