import { describe, expect, it } from 'vitest'
import { mergeFilters } from './mergeFilters'
import { parseSearchQuery } from './searchQuery'

describe('mergeFilters', () => {
  it('crosses OR-of-AND groups and dedupes entries', () => {
    const merged = mergeFilters({ tagGroups: [['a'], ['b']] }, { tagGroups: [['a', '-x']] })
    expect(merged?.tagGroups).toEqual([
      ['a', '-x'],
      ['b', 'a', '-x']
    ])
  })

  it('keeps one side when the other has no groups', () => {
    expect(mergeFilters({}, { characterGroups: [['c']] })?.characterGroups).toEqual([['c']])
  })

  it('returns null for different scalars', () => {
    expect(mergeFilters({ type: 'gif' }, { type: 'image' })).toBeNull()
    expect(mergeFilters({ sfw: true }, { sfw: false })).toBeNull()
    expect(mergeFilters({ artistId: 'a' }, { artistId: 'b' })).toBeNull()
  })

  it('keeps both queries in force, even with an unterminated quote', () => {
    const merged = mergeFilters({ query: 'a "b' }, { query: 'c' })!
    expect(parseSearchQuery(merged.query!)).toEqual({
      type: 'and',
      children: [
        { type: 'term', value: 'a' },
        { type: 'term', value: 'b' },
        { type: 'term', value: 'c' }
      ]
    })
  })

  it('treats an ai token as a scalar', () => {
    expect(mergeFilters({ query: 'ai' }, { query: '-ai' })).toBeNull()
    expect(mergeFilters({ query: 'ai x' }, { isAiGenerated: false })).toBeNull()
    expect(mergeFilters({ query: 'ai' }, { isAiGenerated: true })).toMatchObject({
      isAiGenerated: true
    })
  })

  it('keeps an exclusion marked exact by its own side, so forms stay allowed', () => {
    const merged = mergeFilters({}, { characterGroups: [['-p']], exactCharacterIds: ['p'] })
    expect(merged?.exactCharacterIds).toEqual(['p'])

    const onTop = mergeFilters(
      { characterGroups: [['-p']], exactCharacterIds: ['p'] },
      { sfw: true }
    )
    expect(onTop?.exactCharacterIds).toEqual(['p'])
  })

  it('lets a plain exclusion on one side beat an exact one on the other', () => {
    const merged = mergeFilters(
      { characterGroups: [['-p']], exactCharacterIds: ['p'] },
      { characterGroups: [['-p']] }
    )
    expect(merged?.exactCharacterIds).toBeUndefined()
  })

  it('removes an id excluded by either side from the exact set', () => {
    const merged = mergeFilters({ exactCharacterIds: ['p', 'q'] }, { characterGroups: [['-p']] })
    expect(merged?.exactCharacterIds).toEqual(['q'])
  })

  it('turns on a "has none" flag when either side has it', () => {
    expect(mergeFilters({}, { noSeries: true })?.noSeries).toBe(true)
  })

  it('keeps the fields a saved set cannot hold', () => {
    const merged = mergeFilters({ limit: 5, offset: 10, pendingTagging: false }, { sfw: true })
    expect(merged).toMatchObject({ limit: 5, offset: 10, pendingTagging: false, sfw: true })
  })
})
