import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from './formatDate'

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
