import { useCallback, useState } from 'react'
import {
  loadWd14NsfwThreshold,
  saveWd14NsfwThreshold,
  type Wd14NsfwThreshold
} from '../utils/wd14RatingSettings'

interface UseWd14NsfwThresholdResult {
  threshold: Wd14NsfwThreshold
  setThreshold: (next: Wd14NsfwThreshold) => void
}

export function useWd14NsfwThreshold(): UseWd14NsfwThresholdResult {
  const [threshold, setThresholdState] = useState<Wd14NsfwThreshold>(() =>
    loadWd14NsfwThreshold()
  )

  const setThreshold = useCallback((next: Wd14NsfwThreshold) => {
    setThresholdState(next)
    saveWd14NsfwThreshold(next)
  }, [])

  return { threshold, setThreshold }
}
