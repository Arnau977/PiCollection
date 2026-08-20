// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { readGallerySession, resetGallerySession, useGallerySession } from './useGallerySession'

beforeEach(() => {
  resetGallerySession()
})

describe('useGallerySession', () => {
  it('populates the shared session with the initial value on mount, before any explicit change', () => {
    renderHook(() =>
      useGallerySession(() => ({ filters: { sfw: true }, sorting: { prop: 'name' }, page: 0 }))
    )

    // Regression: readGallerySession() (used by useAdjacentMedia for prev/next
    // navigation) previously stayed null until the user explicitly changed a
    // filter/sort/page, so a page-load-only default filter (e.g. "SFW only")
    // was silently ignored by the detail view's arrow navigation, even though
    // the gallery grid itself - reading local component state, not the
    // shared session - respected it correctly.
    expect(readGallerySession()).toEqual({
      filters: { sfw: true },
      sorting: { prop: 'name' },
      page: 0
    })
  })

  it('reuses an already-written session instead of the initializer, when one exists', () => {
    renderHook(() =>
      useGallerySession(() => ({ filters: { sfw: true }, sorting: { prop: 'name' }, page: 0 }))
    )

    const { result } = renderHook(() =>
      useGallerySession(() => ({
        filters: { sfw: false },
        sorting: { prop: 'createdAt' },
        page: 0
      }))
    )

    expect(result.current.filters).toEqual({ sfw: true })
  })

  it('still keeps the shared session in sync after an explicit change', () => {
    const { result } = renderHook(() =>
      useGallerySession(() => ({ filters: {}, sorting: { prop: 'createdAt' }, page: 0 }))
    )

    act(() => result.current.setFilters({ sfw: false }))

    expect(readGallerySession()?.filters).toEqual({ sfw: false })
  })
})
