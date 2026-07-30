import { describe, expect, it } from 'vitest'
import { filterByQuery } from './filterByQuery'

interface Item {
  name: string
}

const items: Item[] = [{ name: 'Landscape' }, { name: 'Portrait' }, { name: 'Abstract art' }]

describe('filterByQuery', () => {
  it('returns all items when the query is empty', () => {
    expect(filterByQuery(items, '', (i) => i.name)).toEqual(items)
    expect(filterByQuery(items, '   ', (i) => i.name)).toEqual(items)
  })

  it('filters items whose label contains the query, case-insensitively', () => {
    const result = filterByQuery(items, 'land', (i) => i.name)
    expect(result).toEqual([{ name: 'Landscape' }])
  })

  it('matches substrings anywhere in the label, not just the start', () => {
    const result = filterByQuery(items, 'tra', (i) => i.name)
    expect(result.map((i) => i.name)).toEqual(['Portrait', 'Abstract art'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterByQuery(items, 'zzz', (i) => i.name)).toEqual([])
  })
})
