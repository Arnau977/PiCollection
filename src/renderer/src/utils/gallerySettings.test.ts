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
      hideNames: true
    })

    expect(loadGalleryDefaults()).toEqual({
      sfw: true,
      type: 'video',
      sortProp: 'name',
      sortDesc: false,
      blurNsfw: false,
      hideNames: true
    })
  })

  it('falls back to defaults when the stored value is corrupted JSON', () => {
    window.localStorage.setItem('picollection:gallery-defaults', 'not-json')
    expect(loadGalleryDefaults()).toEqual(FALLBACK_GALLERY_DEFAULTS)
  })
})
