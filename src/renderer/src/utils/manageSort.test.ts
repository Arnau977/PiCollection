// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import {
  loadManageSort,
  loadManageViewMode,
  saveManageSort,
  saveManageViewMode,
  sortManageEntities
} from './manageSort'

interface Item {
  name: string
  createdAt?: number
}

describe('sortManageEntities', () => {
  const items: Item[] = [
    { name: 'Zebra', createdAt: 100 },
    { name: 'apple', createdAt: 300 },
    { name: 'Mango', createdAt: 200 }
  ]

  it('sorts by name ascending, case-insensitively', () => {
    const result = sortManageEntities(items, { prop: 'name', desc: false })
    expect(result.map((i) => i.name)).toEqual(['apple', 'Mango', 'Zebra'])
  })

  it('sorts by name descending', () => {
    const result = sortManageEntities(items, { prop: 'name', desc: true })
    expect(result.map((i) => i.name)).toEqual(['Zebra', 'Mango', 'apple'])
  })

  it('sorts by createdAt ascending', () => {
    const result = sortManageEntities(items, { prop: 'createdAt', desc: false })
    expect(result.map((i) => i.createdAt)).toEqual([100, 200, 300])
  })

  it('sorts by createdAt descending', () => {
    const result = sortManageEntities(items, { prop: 'createdAt', desc: true })
    expect(result.map((i) => i.createdAt)).toEqual([300, 200, 100])
  })

  it('does not mutate the input array', () => {
    const copy = [...items]
    sortManageEntities(items, { prop: 'name', desc: false })
    expect(items).toEqual(copy)
  })

  it('sorts by count ascending using mediaCount by default', () => {
    const withCounts = [
      { name: 'a', mediaCount: 5 },
      { name: 'b', mediaCount: 1 },
      { name: 'c', mediaCount: 3 }
    ]
    const result = sortManageEntities(withCounts, { prop: 'count', desc: false })
    expect(result.map((i) => i.name)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by count descending', () => {
    const withCounts = [
      { name: 'a', mediaCount: 5 },
      { name: 'b', mediaCount: 1 },
      { name: 'c', mediaCount: 3 }
    ]
    const result = sortManageEntities(withCounts, { prop: 'count', desc: true })
    expect(result.map((i) => i.name)).toEqual(['a', 'c', 'b'])
  })

  it('treats a missing mediaCount as 0 when sorting by count', () => {
    const mixed = [{ name: 'a', mediaCount: 2 }, { name: 'b' }]
    const result = sortManageEntities(mixed, { prop: 'count', desc: false })
    expect(result.map((i) => i.name)).toEqual(['b', 'a'])
  })

  it('uses a custom getCount accessor when provided, ignoring mediaCount', () => {
    const items = [
      { name: 'a', mediaCount: 1 },
      { name: 'b', mediaCount: 99 }
    ]
    const rolledUp = new Map([['a', 50], ['b', 2]])
    const result = sortManageEntities(
      items,
      { prop: 'count', desc: false },
      (i) => rolledUp.get(i.name) ?? 0
    )
    expect(result.map((i) => i.name)).toEqual(['b', 'a'])
  })

  it('treats a missing createdAt as 0 when sorting by date', () => {
    const withMissing: Item[] = [{ name: 'a', createdAt: 50 }, { name: 'b' }]
    const result = sortManageEntities(withMissing, { prop: 'createdAt', desc: false })
    expect(result.map((i) => i.name)).toEqual(['b', 'a'])
  })
})

describe('manage sort persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to name ascending when nothing is stored', () => {
    expect(loadManageSort('artists')).toEqual({ prop: 'name', desc: false })
  })

  it('persists and reloads a sort setting per entity kind', () => {
    saveManageSort('tags', { prop: 'createdAt', desc: true })

    expect(loadManageSort('tags')).toEqual({ prop: 'createdAt', desc: true })
    expect(loadManageSort('artists')).toEqual({ prop: 'name', desc: false })
  })

  it('falls back to defaults when the stored value is corrupted JSON', () => {
    window.localStorage.setItem('picollection:manage-sort', 'not-json')
    expect(loadManageSort('characters')).toEqual({ prop: 'name', desc: false })
  })

  it('falls back to defaults when the stored value is valid JSON but not an object', () => {
    window.localStorage.setItem('picollection:manage-sort', 'null')
    expect(loadManageSort('artists')).toEqual({ prop: 'name', desc: false })
    expect(() => saveManageSort('artists', { prop: 'createdAt', desc: true })).not.toThrow()
  })
})

describe('manage view mode persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to tree when nothing is stored', () => {
    expect(loadManageViewMode('series')).toBe('tree')
  })

  it('persists and reloads a view mode per entity kind', () => {
    saveManageViewMode('series', 'flat')

    expect(loadManageViewMode('series')).toBe('flat')
    expect(loadManageViewMode('characters')).toBe('tree')
  })

  it('falls back to tree when the stored value is corrupted JSON', () => {
    window.localStorage.setItem('picollection:manage-view-mode', 'not-json')
    expect(loadManageViewMode('series')).toBe('tree')
  })
})
