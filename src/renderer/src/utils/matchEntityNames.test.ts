import { describe, expect, it } from 'vitest'
import {
  capitalizeFirstLetter,
  matchEntityNames,
  normalizeEntityName,
  type NameMatchable
} from './matchEntityNames'

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
