// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useWd14NsfwThreshold } from './useWd14NsfwThreshold'
import { loadWd14NsfwThreshold } from '../utils/wd14RatingSettings'

beforeEach(() => {
  window.localStorage.clear()
})

describe('useWd14NsfwThreshold', () => {
  it('reads the current threshold on mount', () => {
    const { result } = renderHook(() => useWd14NsfwThreshold())
    expect(result.current.threshold).toBe('questionable')
  })

  it('setThreshold updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useWd14NsfwThreshold())

    act(() => {
      result.current.setThreshold('explicit')
    })

    expect(result.current.threshold).toBe('explicit')
    expect(loadWd14NsfwThreshold()).toBe('explicit')
  })
})
