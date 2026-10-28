import { describe, expect, it } from 'vitest'
import { parseStorageSort, sortStorageItems } from './storageSort'
import type { StorageBarItem } from './StorageBarList'

const item = (label: string, bytes: number, count?: number): StorageBarItem => ({
  key: label,
  label,
  bytes,
  count
})

const labels = (items: StorageBarItem[]): string[] => items.map((entry) => entry.label)

describe('sortStorageItems', () => {
  const items = [item('b', 10, 5), item('a', 30, 2), item('file.png', 20)]

  it('orders by size, by files (a lone file counts as one) and by name', () => {
    expect(labels(sortStorageItems(items, { prop: 'size', desc: true }))).toEqual([
      'a',
      'file.png',
      'b'
    ])
    expect(labels(sortStorageItems(items, { prop: 'count', desc: true }))).toEqual([
      'b',
      'a',
      'file.png'
    ])
    expect(labels(sortStorageItems(items, { prop: 'name', desc: false }))).toEqual([
      'a',
      'b',
      'file.png'
    ])
  })

  it('breaks ties by name', () => {
    const tied = [item('Zed', 5, 1), item('Amy', 5, 1)]
    expect(labels(sortStorageItems(tied, { prop: 'size', desc: true }))).toEqual(['Amy', 'Zed'])
  })
})

describe('parseStorageSort', () => {
  it('falls back to heaviest first and gives each key its natural direction', () => {
    expect(parseStorageSort(null, null)).toEqual({ prop: 'size', desc: true })
    expect(parseStorageSort('bogus', 'asc')).toEqual({ prop: 'size', desc: true })
    expect(parseStorageSort('name', null)).toEqual({ prop: 'name', desc: false })
    expect(parseStorageSort('count', 'asc')).toEqual({ prop: 'count', desc: false })
  })
})

describe('average per file', () => {
  it('ranks by size over files, a lone file by its own size', () => {
    const items = [item('many', 100, 10), item('few', 90, 2), item('file.gif', 30)]
    expect(labels(sortStorageItems(items, { prop: 'average', desc: true }))).toEqual([
      'few',
      'file.gif',
      'many'
    ])
  })
})
