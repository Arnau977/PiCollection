// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import {
  FALLBACK_GALLERY_DEFAULTS,
  loadGalleryDefaults,
  saveGalleryDefaults
} from './gallerySettings'

beforeEach(() => {
  window.localStorage.clear()
})

describe('gallerySettings', () => {
  it('returns the fallback defaults when nothing is stored', () => {
    expect(loadGalleryDefaults()).toEqual(FALLBACK_GALLERY_DEFAULTS)
  })

  it('persists and reloads saved defaults', () => {
    saveGalleryDefaults({
      sfw: true,
      type: 'video',
      sortProp: 'name',
      sortDesc: false,
      blurNsfw: false,
      hideNames: true,
      pageSize: 120,
      density: 'large'
    })

    expect(loadGalleryDefaults()).toEqual({
      sfw: true,
      type: 'video',
      sortProp: 'name',
      sortDesc: false,
      blurNsfw: false,
      hideNames: true,
      pageSize: 120,
      density: 'large'
    })
  })

  it('falls back to defaults when the stored value is corrupted JSON', () => {
    window.localStorage.setItem('picollection:gallery-defaults', 'not-json')
    expect(loadGalleryDefaults()).toEqual(FALLBACK_GALLERY_DEFAULTS)
  })

  it('fills in pageSize and density with fallbacks for data saved before those fields existed', () => {
    window.localStorage.setItem(
      'picollection:gallery-defaults',
      JSON.stringify({
        sfw: true,
        sortProp: 'createdAt',
        sortDesc: true,
        blurNsfw: true,
        hideNames: false
      })
    )

    expect(loadGalleryDefaults()).toEqual({
      sfw: true,
      sortProp: 'createdAt',
      sortDesc: true,
      blurNsfw: true,
      hideNames: false,
      pageSize: FALLBACK_GALLERY_DEFAULTS.pageSize,
      density: FALLBACK_GALLERY_DEFAULTS.density
    })
  })
})
