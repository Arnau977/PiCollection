import { describe, expect, it } from 'vitest'
import { formatTime } from './formatTime'

describe('formatTime', () => {
  it('reads 0:00 for an unknown or invalid time', () => {
    expect(formatTime(null)).toBe('0:00')
    expect(formatTime(Number.NaN)).toBe('0:00')
    expect(formatTime(-3)).toBe('0:00')
  })

  it('formats minutes and, past an hour, hours', () => {
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(3600)).toBe('1:00:00')
  })
})
