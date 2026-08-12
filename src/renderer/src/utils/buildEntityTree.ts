export interface EntityTreeNode<T> {
  entity: T
  depth: number
  rolledUpCount: number
}

type Hierarchical = { id: string; parentId?: string | null; mediaCount?: number }

/**
 * Flattens `entities` into pre-order (parent, then its children, then next sibling) with each
 * node's `depth` and a `rolledUpCount` that sums its own mediaCount plus every descendant's.
 * Sibling order follows the input array's order; a parentId pointing outside the given list
 * (or missing) is treated as a root, so partial/filtered lists degrade gracefully.
 */
function groupByParent<T extends Hierarchical>(
  entities: T[]
): { byId: Map<string, T>; childrenByParent: Map<string, T[]>; roots: T[] } {
  const byId = new Map(entities.map((e) => [e.id, e]))
  const childrenByParent = new Map<string, T[]>()
  const roots: T[] = []

  for (const entity of entities) {
    if (entity.parentId && byId.has(entity.parentId)) {
      const siblings = childrenByParent.get(entity.parentId) ?? []
      siblings.push(entity)
      childrenByParent.set(entity.parentId, siblings)
    } else {
      roots.push(entity)
    }
  }

  return { byId, childrenByParent, roots }
}

/**
 * Maps each entity's `id` to its own `mediaCount` plus every descendant's -
 * the same per-node total `buildEntityTree`'s `rolledUpCount` already
 * carries, exposed standalone so callers can sort by it *before* building
 * the tree (see `manageSort.ts`'s `getCount` accessor).
 */
export function computeRolledUpCounts<T extends Hierarchical>(entities: T[]): Map<string, number> {
  const { childrenByParent } = groupByParent(entities)
  const rolledUpCounts = new Map<string, number>()

  function computeRolledUpCount(entity: T): number {
    const cached = rolledUpCounts.get(entity.id)
    if (cached !== undefined) return cached
    const own = entity.mediaCount ?? 0
    const children = childrenByParent.get(entity.id) ?? []
    const total = own + children.reduce((sum, child) => sum + computeRolledUpCount(child), 0)
    rolledUpCounts.set(entity.id, total)
    return total
  }
  for (const entity of entities) computeRolledUpCount(entity)

  return rolledUpCounts
}

export function buildEntityTree<T extends Hierarchical>(entities: T[]): EntityTreeNode<T>[] {
  const { childrenByParent, roots } = groupByParent(entities)
  const rolledUpCounts = computeRolledUpCounts(entities)

  const nodes: EntityTreeNode<T>[] = []
  function visit(entity: T, depth: number): void {
    nodes.push({ entity, depth, rolledUpCount: rolledUpCounts.get(entity.id) ?? 0 })
    for (const child of childrenByParent.get(entity.id) ?? []) {
      visit(child, depth + 1)
    }
  }
  for (const root of roots) visit(root, 0)

  return nodes
}

/**
 * Builds a tree containing just `matched` plus every ancestor needed to place them correctly,
 * resolved from `all` - for cases where only a subset is known to be relevant (a search result,
 * a single media's directly-linked entities) but the hierarchy still needs to read the same way
 * it would unfiltered.
 *
 * `rolledUpCount` on the result only sums descendants that are themselves in the ancestor
 * closure of `matched`, not the true global rolled-up count - fine for callers that don't
 * display counts in this partial mode, misleading otherwise.
 */
export function buildAncestorAwareEntityTree<T extends Hierarchical>(
  matched: T[],
  all: T[]
): EntityTreeNode<T>[] {
  const byId = new Map(all.map((e) => [e.id, e]))
  const includedById = new Map<string, T>()

  for (const entity of matched) {
    let current: T | undefined = byId.get(entity.id) ?? entity
    while (current && !includedById.has(current.id)) {
      includedById.set(current.id, current)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
  }

  // Prefer `all`'s order for sibling placement (matches what an unfiltered tree would show). A
  // matched entity not found in `all` (e.g. it hasn't loaded yet) would otherwise vanish
  // entirely if we filtered `all` alone, so it falls back to appearing in walk order.
  const fromAll = all.filter((e) => includedById.has(e.id))
  const notYetLoaded = [...includedById.values()].filter((e) => !byId.has(e.id))

  return buildEntityTree([...fromAll, ...notYetLoaded])
}
