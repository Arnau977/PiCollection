import { describe, expect, it } from 'vitest'
import type { FilterListModel } from '@shared/models'
import { listsSafeToInclude, reachesLostFilter } from './filterListDraft'

const list = (
  id: string,
  includedListIds: string[] = [],
  hasMissingEntities = false
): FilterListModel => ({
  id,
  name: id,
  filters: {},
  includedListIds,
  hasMissingEntities,
  createdAt: 1,
  updatedAt: 1
})

describe('listsSafeToInclude', () => {
  it('leaves out the list itself and any list that already reaches it', () => {
    const lists = [list('a', ['b']), list('b', ['c']), list('c'), list('d')]

    expect(listsSafeToInclude(lists, 'c').map((other) => other.id)).toEqual(['d'])
    expect(listsSafeToInclude(lists, 'a').map((other) => other.id)).toEqual(['b', 'c', 'd'])
  })

  it('offers every list while creating a new one', () => {
    const lists = [list('a'), list('b')]

    expect(listsSafeToInclude(lists, null)).toEqual(lists)
  })
})

describe('reachesLostFilter', () => {
  it('sees a lost filter through an included list', () => {
    const lists = [list('a', ['b']), list('b', ['c']), list('c', [], true), list('d')]

    expect(reachesLostFilter(lists, 'a')).toBe(true)
    expect(reachesLostFilter(lists, 'd')).toBe(false)
  })
})
