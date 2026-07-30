// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebouncedValue } from './useDebouncedValue'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebouncedValue', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 300))
    expect(result.current).toBe('a')
  })

  it('does not update before the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' }
    })

    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(299)
    })

    expect(result.current).toBe('a')
  })

  it('updates to the latest value once the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' }
    })

    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('b')
  })

  it('resets the timer on rapid successive changes, keeping only the last value', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' }
    })

    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    rerender({ value: 'c' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current).toBe('a') // still not settled

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current).toBe('c')
  })
})
