import { describe, expect, it } from 'vitest'
import {
  capitalizeFirstLetter,
  formatCharacterOptionLabel,
  matchCharacterNames,
  matchEntityNames,
  normalizeEntityName,
  titleCaseTagName,
  type NameMatchable
} from './matchEntityNames'
import type { CharacterModel } from '@shared/models'

interface Entity extends NameMatchable {
  id: string
  name: string
  aliases?: string[]
}

function entity(id: string, name: string, aliases?: string[]): Entity {
  return { id, name, aliases }
}

describe('capitalizeFirstLetter', () => {
  it('uppercases just the first character', () => {
    expect(capitalizeFirstLetter('hatsune miku')).toBe('Hatsune miku')
  })

  it('leaves an already-capitalized name unchanged', () => {
    expect(capitalizeFirstLetter('Fate/Grand Order')).toBe('Fate/Grand Order')
  })

  it('handles an empty string', () => {
    expect(capitalizeFirstLetter('')).toBe('')
  })
})

describe('titleCaseTagName', () => {
  it('capitalizes every word', () => {
    expect(titleCaseTagName('large breasts')).toBe('Large Breasts')
    expect(titleCaseTagName('white background')).toBe('White Background')
  })

  it('capitalizes the word right after an opening parenthesis', () => {
    expect(titleCaseTagName('power (chainsaw man)')).toBe('Power (Chainsaw Man)')
  })

  it('leaves a leading digit run alone rather than capitalizing mid-word', () => {
    expect(titleCaseTagName('1girl')).toBe('1girl')
  })
})

describe('normalizeEntityName', () => {
  it('lowercases and collapses underscores/whitespace', () => {
    expect(normalizeEntityName('Hatsune_Miku')).toBe('hatsune miku')
    expect(normalizeEntityName('  Rin   Tohsaka  ')).toBe('rin tohsaka')
  })
})

describe('matchEntityNames', () => {
  it('matches a suggestion to an existing entity by name, case-insensitively', () => {
    const options = [entity('1', 'Hatsune Miku')]
    const result = matchEntityNames([{ name: 'hatsune miku' }], options)
    expect(result.existing).toEqual([options[0]])
    expect(result.missing).toEqual([])
  })

  it('matches underscore-formatted booru names against a normal entity name', () => {
    const options = [entity('1', 'Hatsune Miku')]
    const result = matchEntityNames([{ name: 'hatsune_miku' }], options)
    expect(result.existing).toEqual([options[0]])
  })

  it('matches a suggestion against an alias', () => {
    const options = [entity('1', 'Fate/Grand Order', ['FGO'])]
    const result = matchEntityNames([{ name: 'fgo' }], options)
    expect(result.existing).toEqual([options[0]])
  })

  it('falls back to altNames when only the qualified form matches', () => {
    const options = [entity('1', 'Ishtar (Fate)')]
    const result = matchEntityNames([{ name: 'Ishtar', altNames: ['Ishtar (Fate)'] }], options)
    expect(result.existing).toEqual([options[0]])
  })

  it('prefers a real name over another entity alias on a collision', () => {
    const target = entity('1', 'Fate')
    const decoy = entity('2', 'Something Else', ['Fate'])
    const result = matchEntityNames([{ name: 'Fate' }], [decoy, target])
    expect(result.existing).toEqual([target])
  })

  it('puts unmatched suggestions in missing using the clean base name', () => {
    const result = matchEntityNames([{ name: 'Ishtar', altNames: ['Ishtar (Fate)'] }], [])
    expect(result.missing).toEqual(['Ishtar'])
    expect(result.existing).toEqual([])
  })

  it('collapses duplicate suggestions in both existing and missing buckets', () => {
    const options = [entity('1', 'Miku')]
    const result = matchEntityNames(
      [{ name: 'Miku' }, { name: 'miku' }, { name: 'New' }, { name: 'new' }],
      options
    )
    expect(result.existing).toHaveLength(1)
    expect(result.missing).toEqual(['New'])
  })

  it('drops whitespace-only suggestion names', () => {
    const result = matchEntityNames([{ name: '   ' }], [])
    expect(result.missing).toEqual([])
  })

  it('returns everything as missing when there are no options', () => {
    const result = matchEntityNames([{ name: 'Alice' }, { name: 'Bob' }], [])
    expect(result.existing).toEqual([])
    expect(result.missing).toEqual(['Alice', 'Bob'])
  })

  it('matches the same entity only once even via two different suggestion keys', () => {
    const options = [entity('1', 'Ishtar', ['Fate Ishtar'])]
    const result = matchEntityNames([{ name: 'Ishtar' }, { name: 'Fate Ishtar' }], options)
    expect(result.existing).toEqual([options[0]])
  })
})

function character(
  id: string,
  name: string,
  seriesNames: string[] = [],
  aliases?: string[]
): CharacterModel {
  return {
    id,
    name,
    series: seriesNames.map((seriesName, index) => ({ id: `s-${id}-${index}`, name: seriesName })),
    aliases
  }
}

describe('matchCharacterNames', () => {
  it('behaves like a single-candidate match when there is no name collision', () => {
    const options = [character('1', 'Hatsune Miku')]
    const result = matchCharacterNames([{ name: 'hatsune miku' }], options, [])
    expect(result.existing).toEqual([options[0]])
  })

  it('disambiguates two same-named characters using the series context', () => {
    const fgoIshtar = character('1', 'Ishtar', ['Fate/Grand Order'])
    const otherIshtar = character('2', 'Ishtar', ['Some Other Series'])
    const result = matchCharacterNames(
      [{ name: 'Ishtar' }],
      [otherIshtar, fgoIshtar],
      [normalizeEntityName('Fate/Grand Order')]
    )
    expect(result.existing).toEqual([fgoIshtar])
  })

  it('falls back to the first candidate in array order when the series context cannot disambiguate at all', () => {
    const first = character('1', 'Ishtar', ['Fate/Grand Order'])
    const second = character('2', 'Ishtar', ['Some Other Series'])
    const result = matchCharacterNames([{ name: 'Ishtar' }], [first, second], [])
    expect(result.existing).toEqual([first])
  })

  it('falls back to the first candidate when the series context matches more than one candidate', () => {
    const first = character('1', 'Ishtar', ['Shared Series'])
    const second = character('2', 'Ishtar', ['Shared Series'])
    const result = matchCharacterNames(
      [{ name: 'Ishtar' }],
      [first, second],
      [normalizeEntityName('Shared Series')]
    )
    expect(result.existing).toEqual([first])
  })

  it('still matches by alias for a character with no name collision', () => {
    const options = [character('1', 'Fate/Grand Order Ishtar', [], ['Ishtar'])]
    const result = matchCharacterNames([{ name: 'ishtar' }], options, [])
    expect(result.existing).toEqual([options[0]])
  })

  it('matches the same entity only once even via two different suggestion keys', () => {
    const options = [character('1', 'Ishtar', [], ['Fate Ishtar'])]
    const result = matchCharacterNames(
      [{ name: 'Ishtar' }, { name: 'Fate Ishtar' }],
      options,
      []
    )
    expect(result.existing).toEqual([options[0]])
  })

  it('puts an unmatched suggestion in missing', () => {
    const result = matchCharacterNames([{ name: 'New Character' }], [], [])
    expect(result.missing).toEqual(['New Character'])
    expect(result.existing).toEqual([])
  })
})

describe('formatCharacterOptionLabel', () => {
  it('returns the bare name when the character has no linked series', () => {
    expect(formatCharacterOptionLabel(character('1', 'Ishtar'))).toBe('Ishtar')
  })

  it('appends a single linked series in parentheses', () => {
    expect(formatCharacterOptionLabel(character('1', 'Ishtar', ['Fate/Grand Order']))).toBe(
      'Ishtar (Fate/Grand Order)'
    )
  })

  it('joins multiple linked series with a comma', () => {
    expect(
      formatCharacterOptionLabel(character('1', 'Ishtar', ['Fate/Grand Order', 'Fate/EXTRA']))
    ).toBe('Ishtar (Fate/Grand Order, Fate/EXTRA)')
  })
})
