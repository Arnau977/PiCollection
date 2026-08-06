import { describe, expect, it } from 'vitest'
import {
  buildSeriesClosureMap,
  wouldCreateCycle,
  type SeriesHierarchyNode
} from './seriesHierarchy'

describe('buildSeriesClosureMap', () => {
  it('returns just itself for a series with no children', () => {
    const hierarchy: SeriesHierarchyNode[] = [{ id: 'a', parentId: null }]

    const closures = buildSeriesClosureMap(hierarchy, ['a'])

    expect(closures.get('a')).toEqual(['a'])
  })

  it('includes a direct child when resolving the parent', () => {
    const hierarchy: SeriesHierarchyNode[] = [
      { id: 'parent', parentId: null },
      { id: 'child', parentId: 'parent' }
    ]

    const closures = buildSeriesClosureMap(hierarchy, ['parent'])

    expect(closures.get('parent')?.sort()).toEqual(['child', 'parent'])
  })

  it('includes every descendant across multiple levels', () => {
    const hierarchy: SeriesHierarchyNode[] = [
      { id: 'grandparent', parentId: null },
      { id: 'parent', parentId: 'grandparent' },
      { id: 'child', parentId: 'parent' }
    ]

    const closures = buildSeriesClosureMap(hierarchy, ['grandparent'])

    expect(closures.get('grandparent')?.sort()).toEqual(['child', 'grandparent', 'parent'])
  })

  it('does not include an unrelated sibling branch', () => {
    const hierarchy: SeriesHierarchyNode[] = [
      { id: 'parent', parentId: null },
      { id: 'childA', parentId: 'parent' },
      { id: 'unrelated', parentId: null },
      { id: 'unrelatedChild', parentId: 'unrelated' }
    ]

    const closures = buildSeriesClosureMap(hierarchy, ['parent'])

    expect(closures.get('parent')?.sort()).toEqual(['childA', 'parent'])
  })

  it('resolves an independent closure for each requested id', () => {
    const hierarchy: SeriesHierarchyNode[] = [
      { id: 'parent', parentId: null },
      { id: 'child', parentId: 'parent' },
      { id: 'other', parentId: null }
    ]

    const closures = buildSeriesClosureMap(hierarchy, ['parent', 'other'])

    expect(closures.get('parent')?.sort()).toEqual(['child', 'parent'])
    expect(closures.get('other')?.sort()).toEqual(['other'])
  })
})

describe('wouldCreateCycle', () => {
  it('is false when the candidate parent has no relation to the series', () => {
    const hierarchy: SeriesHierarchyNode[] = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: null }
    ]

    expect(wouldCreateCycle(hierarchy, 'a', 'b')).toBe(false)
  })

  it('is true when parenting a series to itself', () => {
    const hierarchy: SeriesHierarchyNode[] = [{ id: 'a', parentId: null }]

    expect(wouldCreateCycle(hierarchy, 'a', 'a')).toBe(true)
  })

  it('is true when the candidate parent is already a descendant of the series', () => {
    const hierarchy: SeriesHierarchyNode[] = [
      { id: 'grandparent', parentId: null },
      { id: 'parent', parentId: 'grandparent' },
      { id: 'child', parentId: 'parent' }
    ]

    expect(wouldCreateCycle(hierarchy, 'grandparent', 'child')).toBe(true)
  })

  it('is false when the candidate parent is an ancestor further up the tree', () => {
    const hierarchy: SeriesHierarchyNode[] = [
      { id: 'grandparent', parentId: null },
      { id: 'parent', parentId: 'grandparent' },
      { id: 'child', parentId: 'parent' }
    ]

    expect(wouldCreateCycle(hierarchy, 'child', 'grandparent')).toBe(false)
  })
})
