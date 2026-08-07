import { useCallback, useEffect, useState } from 'react'
import type { ArtistModel, CharacterModel, SeriesModel, TagModel } from '@shared/models'
import type { IpcResult } from '@shared/ipc/contracts'

interface ListState<T> {
  data: T[]
  loading: boolean
  error: string | null
}

type ListHookResult<T> = ListState<T> & { refetch: () => void }

const INITIAL_STATE = { data: [], loading: true, error: null }

interface ListCacheEntry<T> {
  state: ListState<T>
  subscribers: Set<(state: ListState<T>) => void>
  inFlight: boolean
}

// Test-only reset hooks, one pushed per `createListHook` call below; see
// `__resetEntityListCachesForTests` at the bottom of this file.
const resetters: Array<() => void> = []

/**
 * One factory shared by every entity-list hook, so the four near-identical
 * bodies collapse to one call each, and - the part that actually matters -
 * every component calling the same hook shares one fetch and one cache
 * entry instead of each mounting its own independent `useState`/`useEffect`
 * pair. A fresh `MediaForm` mounted per queued import no longer re-fetches
 * all four lists from scratch; `refetch()` from any one subscriber notifies
 * every other mounted subscriber of the new data.
 */
function createListHook<T>(fetchAll: () => Promise<IpcResult<T[]>>): () => ListHookResult<T> {
  const cache: ListCacheEntry<T> = {
    state: INITIAL_STATE,
    subscribers: new Set(),
    inFlight: false
  }

  resetters.push(() => {
    cache.state = INITIAL_STATE
    cache.subscribers.clear()
    cache.inFlight = false
  })

  function notify(): void {
    for (const subscriber of cache.subscribers) subscriber(cache.state)
  }

  function load(): void {
    if (cache.inFlight) return
    cache.inFlight = true
    cache.state = { ...cache.state, loading: true }
    notify()

    fetchAll().then((result) => {
      cache.inFlight = false
      cache.state = result.success
        ? { data: result.data, loading: false, error: null }
        : { data: [], loading: false, error: result.error.message }
      notify()
    })
  }

  return function useList(): ListHookResult<T> {
    const [state, setState] = useState<ListState<T>>(cache.state)

    useEffect(() => {
      cache.subscribers.add(setState)
      setState(cache.state)
      if (cache.state === INITIAL_STATE && !cache.inFlight) load()

      return (): void => {
        cache.subscribers.delete(setState)
      }
    }, [])

    const refetch = useCallback(() => load(), [])
    return { ...state, refetch }
  }
}

export const useArtists = createListHook<ArtistModel>(() => window.api.artist.getAll())
export const useTags = createListHook<TagModel>(() => window.api.tag.getAll())
export const useCharacters = createListHook<CharacterModel>(() => window.api.character.getAll())
export const useSeries = createListHook<SeriesModel>(() => window.api.series.getAll())

/**
 * Test-only: clears every entity-list module cache back to its initial,
 * never-fetched state. The cache above is module-scoped by design (that's
 * the point - it's shared across every component mounted in the same
 * renderer process), but that means it also persists across tests within
 * one test file. Without this reset, a cache entry populated by an earlier
 * test shadows the next test's `getAll` mock and its hook never re-fetches
 * on mount, mirroring the `resetLoggingEnabledCache()` pattern used for the
 * settings-file cache. Call from `beforeEach` in any test file that renders
 * one of these hooks.
 */
export function __resetEntityListCachesForTests(): void {
  for (const reset of resetters) reset()
}
