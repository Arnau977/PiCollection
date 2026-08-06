import type { SeriesModel } from '@shared/models'

export interface SeriesTreeNode {
  series: SeriesModel
  depth: number
  rolledUpCount: number
}

/**
 * Flattens `series` into pre-order (parent, then its children, then next sibling) with each
 * node's `depth` and a `rolledUpCount` that sums its own mediaCount plus every descendant's.
 * Sibling order follows the input array's order; a parentId pointing outside the given list
 * (or missing) is treated as a root, so partial/filtered lists degrade gracefully.
 */
export function buildSeriesTree(series: SeriesModel[]): SeriesTreeNode[] {
  const byId = new Map(series.map((s) => [s.id, s]))
  const childrenByParent = new Map<string, SeriesModel[]>()
  const roots: SeriesModel[] = []

  for (const s of series) {
    if (s.parentId && byId.has(s.parentId)) {
      const siblings = childrenByParent.get(s.parentId) ?? []
      siblings.push(s)
      childrenByParent.set(s.parentId, siblings)
    } else {
      roots.push(s)
    }
  }

  function rolledUpCount(s: SeriesModel): number {
    const own = s.mediaCount ?? 0
    const children = childrenByParent.get(s.id) ?? []
    return own + children.reduce((sum, child) => sum + rolledUpCount(child), 0)
  }

  const nodes: SeriesTreeNode[] = []
  function visit(s: SeriesModel, depth: number): void {
    nodes.push({ series: s, depth, rolledUpCount: rolledUpCount(s) })
    for (const child of childrenByParent.get(s.id) ?? []) {
      visit(child, depth + 1)
    }
  }
  for (const root of roots) visit(root, 0)

  return nodes
}
