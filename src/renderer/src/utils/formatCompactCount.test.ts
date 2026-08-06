import { describe, expect, it } from 'vitest'
import { formatCompactCount } from './formatCompactCount'

describe('formatCompactCount', () => {
  it('renders small counts as-is', () => {
    expect(formatCompactCount(0)).toBe('0')
    expect(formatCompactCount(984)).toBe('984')
  })

  it('abbreviates thousands with a k suffix', () => {
    expect(formatCompactCount(5900)).toBe('5.9k')
    expect(formatCompactCount(29000)).toBe('29k')
  })

  it('abbreviates millions with an M suffix', () => {
    expect(formatCompactCount(1500000)).toBe('1.5M')
  })
})
