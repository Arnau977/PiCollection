import { useCallback, useState } from 'react'

export function useLocalLoading(): {
  loading: boolean
  startLoading: () => void
  stopLoading: () => void
} {
  const [loading, setLoading] = useState(false)

  const startLoading = useCallback(() => setLoading(true), [])
  const stopLoading = useCallback(() => setLoading(false), [])

  return { loading, startLoading, stopLoading }
}
