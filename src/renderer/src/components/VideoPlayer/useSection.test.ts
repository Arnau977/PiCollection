// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSection } from './useSection'

describe('useSection', () => {
  it('normalizes a reversed section', () => {
    const { result } = renderHook(() => useSection(10))
    act(() => result.current.setA(8))
    act(() => result.current.setB(3))
    expect(result.current.section).toEqual({ start: 3, end: 8 })
  })

  it('clamps to the video and rejects a near-zero section', () => {
    const { result } = renderHook(() => useSection(10))
    act(() => result.current.setA(9))
    act(() => result.current.setB(12))
    expect(result.current.section).toEqual({ start: 9, end: 10 })

    act(() => result.current.clear())
    act(() => result.current.setA(5))
    act(() => result.current.setB(5.05))
    expect(result.current.section).toBeNull()
  })

  it('takes the start of the video as A when B comes first', () => {
    const { result } = renderHook(() => useSection(10))
    act(() => result.current.setB(4))
    expect(result.current.section).toEqual({ start: 0, end: 4 })
  })

  it('remembers a lone A until B arrives, and clears both', () => {
    const { result } = renderHook(() => useSection(10))
    act(() => result.current.setA(2))
    expect(result.current.section).toBeNull()
    expect(result.current.pendingStart).toBe(2)

    act(() => result.current.setB(6))
    expect(result.current.section).toEqual({ start: 2, end: 6 })
    act(() => result.current.clear())
    expect(result.current.section).toBeNull()
    expect(result.current.pendingStart).toBeNull()
  })
})

describe('useSection edits', () => {
  it('keeps the section when an edit would make it too short to loop', () => {
    const { result } = renderHook(() => useSection(10))
    act(() => result.current.setA(2))
    act(() => result.current.setB(4))

    act(() => result.current.setSection({ start: 3.95, end: 4 }))
    expect(result.current.section).toEqual({ start: 2, end: 4 })
    act(() => result.current.setA(3.98))
    expect(result.current.section).toEqual({ start: 2, end: 4 })
  })
})
