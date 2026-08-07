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

  const rolledUpCounts = new Map<string, number>()
  function computeRolledUpCount(s: SeriesModel): number {
    const cached = rolledUpCounts.get(s.id)
    if (cached !== undefined) return cached
    const own = s.mediaCount ?? 0
    const children = childrenByParent.get(s.id) ?? []
    const total = own + children.reduce((sum, child) => sum + computeRolledUpCount(child), 0)
    rolledUpCounts.set(s.id, total)
    return total
  }
  for (const s of series) computeRolledUpCount(s)

  const nodes: SeriesTreeNode[] = []
  function visit(s: SeriesModel, depth: number): void {
    nodes.push({ series: s, depth, rolledUpCount: rolledUpCounts.get(s.id) ?? 0 })
    for (const child of childrenByParent.get(s.id) ?? []) {
      visit(child, depth + 1)
    }
  }
  for (const root of roots) visit(root, 0)

  return nodes
}

/**
 * Builds a tree containing just `matched` plus every ancestor needed to place them correctly,
 * resolved from `allSeries` - for cases where only a subset of series is known to be relevant
 * (a search result, a single media's directly-linked series) but the hierarchy still needs to
 * read the same way it would unfiltered.
 *
 * `rolledUpCount` on the result only sums descendants that are themselves in the ancestor
 * closure of `matched`, not the true global rolled-up count - fine for callers that don't
 * display counts in this partial mode, misleading otherwise.
 */
export function buildAncestorAwareSeriesTree(
  matched: SeriesModel[],
  allSeries: SeriesModel[]
): SeriesTreeNode[] {
  const byId = new Map(allSeries.map((s) => [s.id, s]))
  const includedById = new Map<string, SeriesModel>()

  for (const series of matched) {
    let current: SeriesModel | undefined = byId.get(series.id) ?? series
    while (current && !includedById.has(current.id)) {
      includedById.set(current.id, current)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
  }

  // Prefer `allSeries`'s order for sibling placement (matches what an unfiltered tree would
  // show). A matched series not found in `allSeries` (e.g. it hasn't loaded yet) would otherwise
  // vanish entirely if we filtered `allSeries` alone, so it falls back to appearing in walk order.
  const fromAllSeries = allSeries.filter((s) => includedById.has(s.id))
  const notYetLoaded = [...includedById.values()].filter((s) => !byId.has(s.id))

  return buildSeriesTree([...fromAllSeries, ...notYetLoaded])
}
