import { describe, expect, it } from 'vitest'
import { hasActiveFilters } from './hasActiveFilters'

describe('hasActiveFilters', () => {
  it('returns false for an empty filters object', () => {
    expect(hasActiveFilters({})).toBe(false)
  })

  it('returns false when only pagination fields are set', () => {
    expect(hasActiveFilters({ limit: 60, offset: 60 })).toBe(false)
  })

  it('returns true when a search query is set', () => {
    expect(hasActiveFilters({ query: 'sunset' })).toBe(true)
  })

  it('returns false for a whitespace-only search query', () => {
    expect(hasActiveFilters({ query: '   ' })).toBe(false)
  })

  it('returns true when sfw is explicitly false (not just falsy/unset)', () => {
    expect(hasActiveFilters({ sfw: false })).toBe(true)
  })

  it('returns true when tagGroups has a non-empty group', () => {
    expect(hasActiveFilters({ tagGroups: [['t1']] })).toBe(true)
  })

  it('returns false when tagGroups is empty or only has empty groups', () => {
    expect(hasActiveFilters({ tagGroups: [] })).toBe(false)
    expect(hasActiveFilters({ tagGroups: [[], []] })).toBe(false)
  })

  it('returns true when characterGroups has a non-empty group', () => {
    expect(hasActiveFilters({ characterGroups: [['c1']] })).toBe(true)
  })

  it('returns true when seriesIds has entries', () => {
    expect(hasActiveFilters({ seriesIds: ['s1'] })).toBe(true)
  })

  it('returns false when seriesIds is an empty array', () => {
    expect(hasActiveFilters({ seriesIds: [] })).toBe(false)
  })

  it('returns true when artistId is set', () => {
    expect(hasActiveFilters({ artistId: 'a1' })).toBe(true)
  })

  it('returns true when type is set', () => {
    expect(hasActiveFilters({ type: 'video' })).toBe(true)
  })

  it('is true when isAiGenerated is set', () => {
    expect(hasActiveFilters({ isAiGenerated: true })).toBe(true)
    expect(hasActiveFilters({ isAiGenerated: false })).toBe(true)
  })
})
