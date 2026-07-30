import { useCallback, useState } from 'react'
import {
  loadGalleryDefaults,
  saveGalleryDefaults,
  type GalleryDefaults
} from '../utils/gallerySettings'

interface UseGalleryDefaultsResult {
  defaults: GalleryDefaults
  setDefaults: (next: GalleryDefaults) => void
}

export function useGalleryDefaults(): UseGalleryDefaultsResult {
  const [defaults, setDefaultsState] = useState<GalleryDefaults>(() => loadGalleryDefaults())

  const setDefaults = useCallback((next: GalleryDefaults) => {
    setDefaultsState(next)
    saveGalleryDefaults(next)
  }, [])

  return { defaults, setDefaults }
}
