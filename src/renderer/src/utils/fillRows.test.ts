import { describe, expect, it } from 'vitest'
import { itemCountForColumns } from './fillRows'

describe('itemCountForColumns', () => {
  it('returns 0 when there are no columns to fill', () => {
    expect(itemCountForColumns(0)).toBe(0)
  })

  it('fills 2 rows when that stays within the cap', () => {
    expect(itemCountForColumns(4)).toBe(8)
    expect(itemCountForColumns(8)).toBe(16)
  })

  it('falls back to 1 row once 2 rows would exceed the cap', () => {
    expect(itemCountForColumns(9)).toBe(9)
    expect(itemCountForColumns(20)).toBe(20)
  })

  it('respects a custom cap', () => {
    expect(itemCountForColumns(5, 8)).toBe(5)
    expect(itemCountForColumns(4, 8)).toBe(8)
  })
})
