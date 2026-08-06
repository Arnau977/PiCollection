import { describe, expect, it } from 'vitest'
import { buildAncestorAwareSeriesTree, buildSeriesTree } from './buildSeriesTree'
import type { SeriesModel } from '@shared/models'

function series(id: string, parentId: string | null, mediaCount = 0): SeriesModel {
  return { id, name: id, parentId, mediaCount }
}

describe('buildSeriesTree', () => {
  it('gives every root-level series depth 0 and its own count as the rolled-up count', () => {
    const nodes = buildSeriesTree([series('a', null, 3), series('b', null, 5)])

    expect(nodes).toEqual([
      { series: series('a', null, 3), depth: 0, rolledUpCount: 3 },
      { series: series('b', null, 5), depth: 0, rolledUpCount: 5 }
    ])
  })

  it('nests a child directly after its parent at depth 1, rolling its count into the parent', () => {
    const parent = series('parent', null, 2)
    const child = series('child', 'parent', 5)

    const nodes = buildSeriesTree([parent, child])

    expect(nodes.map((n) => [n.series.id, n.depth])).toEqual([
      ['parent', 0],
      ['child', 1]
    ])
    expect(nodes.find((n) => n.series.id === 'parent')?.rolledUpCount).toBe(7)
  })

  it('rolls counts up through every level of a multi-level chain', () => {
    const nodes = buildSeriesTree([
      series('grandparent', null, 1),
      series('parent', 'grandparent', 2),
      series('child', 'parent', 4)
    ])

    expect(nodes.find((n) => n.series.id === 'grandparent')?.rolledUpCount).toBe(7)
    expect(nodes.find((n) => n.series.id === 'parent')?.rolledUpCount).toBe(6)
    expect(nodes.find((n) => n.series.id === 'child')?.rolledUpCount).toBe(4)
  })

  it('treats a series whose parentId is missing from the list as a root', () => {
    const nodes = buildSeriesTree([series('orphan', 'does-not-exist', 1)])

    expect(nodes).toEqual([
      { series: series('orphan', 'does-not-exist', 1), depth: 0, rolledUpCount: 1 }
    ])
  })

  it('preserves input order among siblings and interleaves children right after their parent', () => {
    const nodes = buildSeriesTree([
      series('rootB', null),
      series('rootA', null),
      series('rootA-child', 'rootA')
    ])

    expect(nodes.map((n) => n.series.id)).toEqual(['rootB', 'rootA', 'rootA-child'])
  })

  it('defaults a missing mediaCount to 0', () => {
    const nodes = buildSeriesTree([{ id: 'a', name: 'a', parentId: null }])

    expect(nodes[0].rolledUpCount).toBe(0)
  })
})

describe('buildAncestorAwareSeriesTree', () => {
  const grandparent = series('grandparent', null)
  const parent = series('parent', 'grandparent')
  const child = series('child', 'parent')
  const unrelated = series('unrelated', null)
  const all = [grandparent, parent, child, unrelated]

  it("pulls in a matched series' whole ancestor chain, even though only the leaf matched", () => {
    const nodes = buildAncestorAwareSeriesTree([child], all)

    expect(nodes.map((n) => [n.series.id, n.depth])).toEqual([
      ['grandparent', 0],
      ['parent', 1],
      ['child', 2]
    ])
  })

  it('leaves a parentless matched series as a single root node', () => {
    const nodes = buildAncestorAwareSeriesTree([unrelated], all)

    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ series: unrelated, depth: 0 })
  })

  it('does not duplicate an ancestor shared by two matched descendants', () => {
    const otherChild = series('other-child', 'parent')
    const withSibling = [...all, otherChild]

    const nodes = buildAncestorAwareSeriesTree([child, otherChild], withSibling)

    expect(nodes.map((n) => n.series.id)).toEqual(['grandparent', 'parent', 'child', 'other-child'])
  })

  it("follows allSeries's order for sibling placement, not the order matches were passed in", () => {
    const rootB = series('rootB', null)
    const rootA = series('rootA', null)
    const orderedAll = [rootB, rootA]

    // Passed in reverse of `orderedAll` - the result should still follow orderedAll's order.
    const nodes = buildAncestorAwareSeriesTree([rootA, rootB], orderedAll)

    expect(nodes.map((n) => n.series.id)).toEqual(['rootB', 'rootA'])
  })

  it('excludes series that are neither matched nor an ancestor of a match', () => {
    const nodes = buildAncestorAwareSeriesTree([child], all)

    expect(nodes.some((n) => n.series.id === 'unrelated')).toBe(false)
  })

  it("still shows a matched series even when it isn't found in allSeries yet (e.g. still loading)", () => {
    const notYetLoaded = series('not-loaded', null)

    const nodes = buildAncestorAwareSeriesTree([notYetLoaded], [])

    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ series: notYetLoaded, depth: 0 })
  })
})
