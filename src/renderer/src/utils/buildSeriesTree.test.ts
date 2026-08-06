import { describe, expect, it } from 'vitest'
import { buildSeriesTree } from './buildSeriesTree'
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
