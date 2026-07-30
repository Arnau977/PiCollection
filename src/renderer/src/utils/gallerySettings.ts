import type { MediaFilters, MediaSortableProp } from '@shared/models'

const STORAGE_KEY = 'picollection:gallery-defaults'

export interface GalleryDefaults {
  sfw?: boolean
  type?: MediaFilters['type']
  sortProp: MediaSortableProp
  sortDesc: boolean
  blurNsfw: boolean
  hideNames: boolean
}

export const FALLBACK_GALLERY_DEFAULTS: GalleryDefaults = {
  sfw: undefined,
  type: undefined,
  sortProp: 'createdAt',
  sortDesc: true,
  blurNsfw: true,
  hideNames: false
}

export function loadGalleryDefaults(): GalleryDefaults {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return FALLBACK_GALLERY_DEFAULTS
    return { ...FALLBACK_GALLERY_DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return FALLBACK_GALLERY_DEFAULTS
  }
}

export function saveGalleryDefaults(defaults: GalleryDefaults): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
}
