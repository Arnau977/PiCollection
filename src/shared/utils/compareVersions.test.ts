import { describe, expect, it } from 'vitest'
import { compareVersions } from './compareVersions'

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.4.0', '1.4.0')).toBe(0)
  })

  it('returns a negative number when the first version is older (major/minor/patch)', () => {
    expect(compareVersions('1.3.0', '1.4.0')).toBeLessThan(0)
    expect(compareVersions('1.4.0', '1.4.1')).toBeLessThan(0)
    expect(compareVersions('1.4.0', '2.0.0')).toBeLessThan(0)
  })

  it('returns a positive number when the first version is newer', () => {
    expect(compareVersions('1.4.1', '1.4.0')).toBeGreaterThan(0)
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0)
  })

  it('ignores a prerelease suffix and compares the numeric part', () => {
    expect(compareVersions('1.4.0-beta.1', '1.4.0')).toBe(0)
    expect(compareVersions('1.4.0-beta.2', '1.3.0')).toBeGreaterThan(0)
  })

  it('treats a missing/non-numeric segment as 0', () => {
    expect(compareVersions('1.4', '1.4.0')).toBe(0)
  })
})
