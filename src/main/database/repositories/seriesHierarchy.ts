export interface SeriesHierarchyNode {
  id: string
  parentId: string | null
}

function buildChildrenIndex(hierarchy: SeriesHierarchyNode[]): Map<string, string[]> {
  const childrenByParent = new Map<string, string[]>()
  for (const node of hierarchy) {
    if (node.parentId === null) continue
    const siblings = childrenByParent.get(node.parentId) ?? []
    siblings.push(node.id)
    childrenByParent.set(node.parentId, siblings)
  }
  return childrenByParent
}

/** For each requested id, resolves itself plus every descendant reachable through the tree. */
export function buildSeriesClosureMap(
  hierarchy: SeriesHierarchyNode[],
  ids: string[]
): Map<string, string[]> {
  const childrenByParent = buildChildrenIndex(hierarchy)
  const closures = new Map<string, string[]>()

  for (const id of ids) {
    const closure: string[] = [id]
    const queue = [...(childrenByParent.get(id) ?? [])]
    while (queue.length > 0) {
      const next = queue.shift() as string
      closure.push(next)
      queue.push(...(childrenByParent.get(next) ?? []))
    }
    closures.set(id, closure)
  }

  return closures
}

/** True if setting `candidateParentId` as the parent of `seriesId` would create a cycle. */
export function wouldCreateCycle(
  hierarchy: SeriesHierarchyNode[],
  seriesId: string,
  candidateParentId: string
): boolean {
  const parentById = new Map(hierarchy.map((node) => [node.id, node.parentId]))

  let current: string | null = candidateParentId
  while (current !== null) {
    if (current === seriesId) return true
    current = parentById.get(current) ?? null
  }
  return false
}
