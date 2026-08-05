import { describe, expect, it } from 'vitest'
import { extractAiToken, parseSearchQuery } from './searchQuery'

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

describe('extractAiToken', () => {
  it('returns the node unchanged when there is no ai token', () => {
    const ast = parseSearchQuery('sunset')
    expect(extractAiToken(ast)).toEqual({ node: ast, isAiGenerated: undefined })
  })

  it('extracts a bare "ai" term as isAiGenerated: true', () => {
    expect(extractAiToken(parseSearchQuery('ai'))).toEqual({ node: null, isAiGenerated: true })
  })

  it('is case-insensitive', () => {
    expect(extractAiToken(parseSearchQuery('AI'))).toEqual({ node: null, isAiGenerated: true })
  })

  it('extracts a negated "-ai" term as isAiGenerated: false', () => {
    expect(extractAiToken(parseSearchQuery('-ai'))).toEqual({ node: null, isAiGenerated: false })
  })

  it('extracts ai from an AND chain, leaving the rest of the query intact', () => {
    const result = extractAiToken(parseSearchQuery('landscape ai'))
    expect(result.isAiGenerated).toBe(true)
    expect(result.node).toEqual({ type: 'term', value: 'landscape' })
  })

  it('extracts -ai from an AND chain with multiple other terms', () => {
    const result = extractAiToken(parseSearchQuery('landscape -ai sunset'))
    expect(result.isAiGenerated).toBe(false)
    expect(result.node).toEqual({
      type: 'and',
      children: [
        { type: 'term', value: 'landscape' },
        { type: 'term', value: 'sunset' }
      ]
    })
  })

  it('extracts ai from inside a parenthesized AND group (flattened by the parser)', () => {
    const result = extractAiToken(parseSearchQuery('landscape (sunset ai)'))
    expect(result.isAiGenerated).toBe(true)
    expect(result.node).toEqual({
      type: 'and',
      children: [
        { type: 'term', value: 'landscape' },
        { type: 'term', value: 'sunset' }
      ]
    })
  })

  it('does not extract ai from inside an OR — it is left as a normal search term', () => {
    const ast = parseSearchQuery('ai OR sunset')
    expect(extractAiToken(ast)).toEqual({ node: ast, isAiGenerated: undefined })
  })

  it('does not extract "ai" as a substring of a longer word', () => {
    const ast = parseSearchQuery('fairy')
    expect(extractAiToken(ast)).toEqual({ node: ast, isAiGenerated: undefined })
  })

  it('returns null node and undefined isAiGenerated for a null input', () => {
    expect(extractAiToken(null)).toEqual({ node: null, isAiGenerated: undefined })
  })
})
