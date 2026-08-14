import { describe, expect, it } from 'vitest'
import { cleanEntityName, splitBooruList, splitBooruListWithQualifiers } from './booruName'

describe('splitBooruList', () => {
  it('returns an empty array for undefined or empty input', () => {
    expect(splitBooruList(undefined)).toEqual([])
    expect(splitBooruList('')).toEqual([])
  })

  it('splits and trims a comma-separated list', () => {
    expect(splitBooruList('a, b ,c')).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
  })

  it('converts underscores to spaces', () => {
    expect(splitBooruList('hatsune_miku')).toEqual([{ name: 'hatsune miku' }])
  })

  it('collapses case-insensitive duplicates', () => {
    expect(splitBooruList('Miku, miku, MIKU')).toEqual([{ name: 'Miku' }])
  })

  it('does not split on a slash inside a name', () => {
    expect(splitBooruList('Fate/Grand Order')).toEqual([{ name: 'Fate/Grand Order' }])
  })

  it('drops empty/whitespace-only segments from a trailing comma', () => {
    expect(splitBooruList('a,b,')).toEqual([{ name: 'a' }, { name: 'b' }])
    expect(splitBooruList('a,   ,b')).toEqual([{ name: 'a' }, { name: 'b' }])
  })

  it('joins array input before splitting', () => {
    expect(splitBooruList(['a', 'b'])).toEqual([{ name: 'a' }, { name: 'b' }])
  })

  it('extracts a trailing qualifier into altNames', () => {
    expect(splitBooruList('Ishtar (Fate)')).toEqual([
      { name: 'Ishtar', altNames: ['Ishtar (Fate)'] }
    ])
  })

  it('leaves an unqualified name without altNames', () => {
    expect(splitBooruList('Tsukino Usagi')).toEqual([{ name: 'Tsukino Usagi' }])
  })

  it('strips multiple trailing qualifiers down to a single altNames entry', () => {
    expect(splitBooruList('Rin (Fate) (swimsuit)')).toEqual([
      { name: 'Rin', altNames: ['Rin (Fate) (swimsuit)'] }
    ])
  })

  it('keeps a name that is entirely a parenthetical group', () => {
    expect(splitBooruList('(unknown)')).toEqual([{ name: '(unknown)' }])
  })
})

describe('splitBooruListWithQualifiers', () => {
  it('splits a single name (no comma) the same way a list entry would', () => {
    // A single WD14 suggestion is parsed one at a time, not as part of a
    // comma-joined list, so this must behave identically for one bare name.
    expect(splitBooruListWithQualifiers('seele (honkai: star rail)')).toEqual({
      names: [{ name: 'seele', altNames: ['seele (honkai: star rail)'] }],
      qualifiers: [{ name: 'honkai: star rail' }]
    })
  })
})

describe('cleanEntityName', () => {
  it('does not change casing', () => {
    expect(cleanEntityName('McDonald_Fan')).toBe('McDonald Fan')
  })
})
