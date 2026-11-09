import type { MediaFilters, MediaSortableProp } from '@shared/models'
import { normalizeTypes } from '@shared/query/mediaTypes'

export const GALLERY_DEFAULTS_STORAGE_KEY = 'picollection:gallery-defaults'

export type GalleryDensity = 'compact' | 'comfortable' | 'large'

export interface GalleryDefaults {
  sfw?: boolean
  type?: MediaFilters['type']
  sortProp: MediaSortableProp
  sortDesc: boolean
  blurNsfw: boolean
  hideNames: boolean
  pageSize: number
  density: GalleryDensity
}

export const FALLBACK_GALLERY_DEFAULTS: GalleryDefaults = {
  sfw: undefined,
  type: undefined,
  sortProp: 'createdAt',
  sortDesc: true,
  blurNsfw: true,
  hideNames: false,
  pageSize: 60,
  density: 'comfortable'
}

export function loadGalleryDefaults(): GalleryDefaults {
  try {
    const raw = window.localStorage.getItem(GALLERY_DEFAULTS_STORAGE_KEY)
    if (!raw) return FALLBACK_GALLERY_DEFAULTS
    const stored = JSON.parse(raw) as GalleryDefaults
    // Saved before the type filter took several types: a single one.
    return { ...FALLBACK_GALLERY_DEFAULTS, ...stored, type: normalizeTypes(stored.type) }
  } catch {
    return FALLBACK_GALLERY_DEFAULTS
  }
}

export function saveGalleryDefaults(defaults: GalleryDefaults): void {
  window.localStorage.setItem(GALLERY_DEFAULTS_STORAGE_KEY, JSON.stringify(defaults))
}
