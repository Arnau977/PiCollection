import { describe, expect, it } from 'vitest'
import { parseSearchQuery } from './searchQuery'

describe('parseSearchQuery', () => {
  it('returns null for empty or whitespace-only input', () => {
    expect(parseSearchQuery('')).toBeNull()
    expect(parseSearchQuery('   ')).toBeNull()
  })

  it('parses a single term', () => {
    expect(parseSearchQuery('sunset')).toEqual({ type: 'term', value: 'sunset' })
  })

  it('treats spaces as AND', () => {
    expect(parseSearchQuery('a b')).toEqual({
      type: 'and',
      children: [
        { type: 'term', value: 'a' },
        { type: 'term', value: 'b' }
      ]
    })
  })

  it('parses the OR keyword case-insensitively', () => {
    const expected = {
      type: 'or',
      children: [
        { type: 'term', value: 'a' },
        { type: 'term', value: 'b' }
      ]
    }
    expect(parseSearchQuery('a OR b')).toEqual(expected)
    expect(parseSearchQuery('a or b')).toEqual(expected)
  })

  it('gives AND higher precedence than OR', () => {
    expect(parseSearchQuery('a OR b c')).toEqual({
      type: 'or',
      children: [
        { type: 'term', value: 'a' },
        {
          type: 'and',
          children: [
            { type: 'term', value: 'b' },
            { type: 'term', value: 'c' }
          ]
        }
      ]
    })
  })

  it('parses a leading dash as NOT', () => {
    expect(parseSearchQuery('-a')).toEqual({
      type: 'not',
      child: { type: 'term', value: 'a' }
    })
  })

  it('keeps hyphens inside a word instead of treating them as NOT', () => {
    expect(parseSearchQuery('sci-fi')).toEqual({ type: 'term', value: 'sci-fi' })
  })

  it('parses the documented example query', () => {
    const result = parseSearchQuery('(兹白 OR Zibai) (-スウツ -fujimaru)')

    expect(result).toEqual({
      type: 'and',
      children: [
        {
          type: 'or',
          children: [
            { type: 'term', value: '兹白' },
            { type: 'term', value: 'Zibai' }
          ]
        },
        { type: 'not', child: { type: 'term', value: 'スウツ' } },
        { type: 'not', child: { type: 'term', value: 'fujimaru' } }
      ]
    })
  })

  it('lets parentheses override precedence', () => {
    expect(parseSearchQuery('(a OR b) c')).toEqual({
      type: 'and',
      children: [
        {
          type: 'or',
          children: [
            { type: 'term', value: 'a' },
            { type: 'term', value: 'b' }
          ]
        },
        { type: 'term', value: 'c' }
      ]
    })
  })

  it('parses a negated group', () => {
    expect(parseSearchQuery('-(a b)')).toEqual({
      type: 'not',
      child: {
        type: 'and',
        children: [
          { type: 'term', value: 'a' },
          { type: 'term', value: 'b' }
        ]
      }
    })
  })

  it('supports quoted terms containing spaces', () => {
    expect(parseSearchQuery('"two words"')).toEqual({ type: 'term', value: 'two words' })
  })

  it('parses parentheses that are not separated by spaces', () => {
    expect(parseSearchQuery('(a)(b)')).toEqual({
      type: 'and',
      children: [
        { type: 'term', value: 'a' },
        { type: 'term', value: 'b' }
      ]
    })
  })

  it('flattens nested groups of the same operator', () => {
    expect(parseSearchQuery('a (b c)')).toEqual({
      type: 'and',
      children: [
        { type: 'term', value: 'a' },
        { type: 'term', value: 'b' },
        { type: 'term', value: 'c' }
      ]
    })
  })

  it('tolerates an unclosed parenthesis', () => {
    expect(parseSearchQuery('(a OR b')).toEqual({
      type: 'or',
      children: [
        { type: 'term', value: 'a' },
        { type: 'term', value: 'b' }
      ]
    })
  })

  it('tolerates a dangling operator', () => {
    expect(parseSearchQuery('a OR')).toEqual({ type: 'term', value: 'a' })
    expect(parseSearchQuery('a -')).toEqual({ type: 'term', value: 'a' })
  })

  it('ignores empty groups', () => {
    expect(parseSearchQuery('()')).toBeNull()
    expect(parseSearchQuery('a ()')).toEqual({ type: 'term', value: 'a' })
  })

  it('supports double negation', () => {
    expect(parseSearchQuery('--a')).toEqual({
      type: 'not',
      child: { type: 'not', child: { type: 'term', value: 'a' } }
    })
  })
})
