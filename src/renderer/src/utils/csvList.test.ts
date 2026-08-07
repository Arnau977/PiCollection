import { describe, expect, it } from 'vitest'
import { fromCsv, toCsv } from './csvList'

describe('toCsv', () => {
  it('joins values with a comma and a space', () => {
    expect(toCsv(['a', 'b', 'c'])).toBe('a, b, c')
  })

  it('returns an empty string for an empty array', () => {
    expect(toCsv([])).toBe('')
  })
})

describe('fromCsv', () => {
  it('splits on commas and trims whitespace', () => {
    expect(fromCsv('a, b ,  c')).toEqual(['a', 'b', 'c'])
  })

  it('drops empty entries', () => {
    expect(fromCsv('a,,b,')).toEqual(['a', 'b'])
  })

  it('returns an empty array for an empty string', () => {
    expect(fromCsv('')).toEqual([])
  })
})
