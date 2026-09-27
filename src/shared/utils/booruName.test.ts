import { describe, expect, it } from 'vitest'
import {
  cleanEntityName,
  parseCharacterTag,
  splitBooruCharacterList,
  splitBooruList
} from './booruName'

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

describe('parseCharacterTag', () => {
  it('splits a raw or cleaned tag into its base and every trailing qualifier, in order', () => {
    expect(parseCharacterTag('pyra_(pro_swimmer)_(xenoblade)')).toEqual({
      base: 'pyra',
      qualifiers: ['pro swimmer', 'xenoblade']
    })
    expect(parseCharacterTag('seele (honkai: star rail)')).toEqual({
      base: 'seele',
      qualifiers: ['honkai: star rail']
    })
    expect(parseCharacterTag('Hatsune Miku')).toEqual({ base: 'Hatsune Miku', qualifiers: [] })
  })
})

describe('splitBooruCharacterList', () => {
  it('keeps each full tag, so a form and its base character stay separate', () => {
    expect(
      splitBooruCharacterList('pyra_(xenoblade), pyra (pro swimmer) (xenoblade), Pyra (Xenoblade)')
    ).toEqual([{ name: 'pyra (xenoblade)' }, { name: 'pyra (pro swimmer) (xenoblade)' }])
  })
})

describe('cleanEntityName', () => {
  it('does not change casing', () => {
    expect(cleanEntityName('McDonald_Fan')).toBe('McDonald Fan')
  })
})
