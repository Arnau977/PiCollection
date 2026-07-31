// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useGalleryDefaults } from './useGalleryDefaults'
import { loadGalleryDefaults } from '../utils/gallerySettings'

beforeEach(() => {
  window.localStorage.clear()
})

describe('useGalleryDefaults', () => {
  it('reads the current defaults on mount', () => {
    const { result } = renderHook(() => useGalleryDefaults())
    expect(result.current.defaults.sortProp).toBe('createdAt')
  })

  it('setDefaults updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useGalleryDefaults())

    act(() => {
      result.current.setDefaults({
        sfw: true,
        type: undefined,
        sortProp: 'name',
        sortDesc: false,
        blurNsfw: false,
        hideNames: true,
        pageSize: 120,
        density: 'large'
      })
    })

    expect(result.current.defaults.sfw).toBe(true)
    expect(result.current.defaults.sortProp).toBe('name')
    expect(loadGalleryDefaults()).toEqual({
      sfw: true,
      type: undefined,
      sortProp: 'name',
      sortDesc: false,
      blurNsfw: false,
      hideNames: true,
      pageSize: 120,
      density: 'large'
    })
  })
})
