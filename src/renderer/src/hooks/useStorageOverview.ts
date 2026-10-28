import { useCallback, useEffect, useState } from 'react'
import type { StorageOverview } from '@shared/models'

interface UseStorageOverviewResult {
  data: StorageOverview | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/** The disk-space overview, read once per visit (sizes fill in in the background). */
export function useStorageOverview(): UseStorageOverviewResult {
  const [data, setData] = useState<StorageOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    let cancelled = false
    setLoading(true)
    window.api.stats.getStorage().then((result) => {
      if (cancelled) return
      if (result.success) {
        setData(result.data)
        setError(null)
      } else {
        setError(result.error.message)
      }
      setLoading(false)
    })
    return (): void => {
      cancelled = true
    }
  }, [])

  useEffect(() => refetch(), [refetch])

  return { data, loading, error, refetch }
}
