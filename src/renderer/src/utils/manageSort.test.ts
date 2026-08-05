// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { loadManageSort, saveManageSort, sortManageEntities } from './manageSort'

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
})
