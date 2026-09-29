import { useCallback, useSyncExternalStore } from 'react'
import {
  GALLERY_DEFAULTS_STORAGE_KEY,
  loadGalleryDefaults,
  saveGalleryDefaults,
  type GalleryDefaults
} from '../utils/gallerySettings'

interface UseGalleryDefaultsResult {
  defaults: GalleryDefaults
  setDefaults: (next: GalleryDefaults) => void
}

// Shared by every mounted consumer, so a change made in one place (the
// gallery's blur toggle, its Ctrl+B shortcut, Settings) shows everywhere at
// once instead of only in the component that made it.
const listeners = new Set<() => void>()
let cached: { raw: string | null; value: GalleryDefaults } | null = null

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(GALLERY_DEFAULTS_STORAGE_KEY)
  } catch {
    return null
  }
}

function getSnapshot(): GalleryDefaults {
  const raw = readRaw()
  if (!cached || cached.raw !== raw) cached = { raw, value: loadGalleryDefaults() }
  return cached.value
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return (): void => {
    listeners.delete(listener)
  }
}

export function setGalleryDefaults(next: GalleryDefaults): void {
  saveGalleryDefaults(next)
  listeners.forEach((listener) => listener())
}

export function useGalleryDefaults(): UseGalleryDefaultsResult {
  const defaults = useSyncExternalStore(subscribe, getSnapshot)
  const setDefaults = useCallback((next: GalleryDefaults) => setGalleryDefaults(next), [])
  return { defaults, setDefaults }
}
