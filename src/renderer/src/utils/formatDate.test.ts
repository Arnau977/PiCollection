import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatRelativeTime } from './formatDate'

describe('formatDate', () => {
  it('formats as zero-padded DD/MM/YYYY regardless of locale', () => {
    const epoch = new Date(2026, 0, 5, 14, 5).getTime()
    expect(formatDate(epoch)).toBe('05/01/2026')
  })

  it('zero-pads single-digit day and month', () => {
    const epoch = new Date(2026, 8, 9, 0, 0).getTime()
    expect(formatDate(epoch)).toBe('09/09/2026')
  })
})

describe('formatDateTime', () => {
  it('appends a zero-padded 24h HH:MM after the date', () => {
    const epoch = new Date(2026, 0, 5, 14, 5).getTime()
    expect(formatDateTime(epoch)).toBe('05/01/2026, 14:05')
  })

  it('zero-pads single-digit hours and minutes', () => {
    const epoch = new Date(2026, 0, 5, 9, 3).getTime()
    expect(formatDateTime(epoch)).toBe('05/01/2026, 09:03')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date(2026, 8, 26, 12, 0).getTime()
  const HOUR = 60 * 60 * 1000

  it('picks the largest fitting unit, past and future', () => {
    expect(formatRelativeTime(now - 20 * 1000, now, 'en')).toBe('now')
    expect(formatRelativeTime(now - 3 * HOUR, now, 'en')).toBe('3 hours ago')
    expect(formatRelativeTime(now + 24 * HOUR, now, 'en')).toBe('tomorrow')
    expect(formatRelativeTime(now + 6 * 24 * HOUR, now, 'es')).toBe('dentro de 6 días')
  })
})
