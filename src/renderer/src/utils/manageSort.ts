export type ManageSortProp = 'name' | 'createdAt' | 'count'
export type ManageEntityKind = 'artists' | 'tags' | 'characters' | 'series'
export type ManageViewMode = 'tree' | 'flat'

export interface ManageSort {
  prop: ManageSortProp
  desc: boolean
}

const DEFAULT_SORT: ManageSort = { prop: 'name', desc: false }
const DEFAULT_VIEW_MODE: ManageViewMode = 'tree'

export function sortManageEntities<T extends { name: string; createdAt?: number; mediaCount?: number }>(
  items: T[],
  sort: ManageSort,
  getCount: (item: T) => number = (item) => item.mediaCount ?? 0
): T[] {
  const factor = sort.desc ? -1 : 1
  return items.toSorted((a, b) => {
    if (sort.prop === 'createdAt') return ((a.createdAt ?? 0) - (b.createdAt ?? 0)) * factor
    if (sort.prop === 'count') return (getCount(a) - getCount(b)) * factor
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * factor
  })
}

const SORT_STORAGE_KEY = 'picollection:manage-sort'
const VIEW_MODE_STORAGE_KEY = 'picollection:manage-view-mode'

type StoredManageSort = Partial<Record<ManageEntityKind, ManageSort>>
type StoredManageViewMode = Partial<Record<ManageEntityKind, ManageViewMode>>

function readStore<T>(key: string): Partial<Record<ManageEntityKind, T>> {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed
  } catch {
    return {}
  }
}

export function loadManageSort(kind: ManageEntityKind): ManageSort {
  return readStore<ManageSort>(SORT_STORAGE_KEY)[kind] ?? DEFAULT_SORT
}

export function saveManageSort(kind: ManageEntityKind, sort: ManageSort): void {
  const store: StoredManageSort = readStore<ManageSort>(SORT_STORAGE_KEY)
  store[kind] = sort
  window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(store))
}

export function loadManageViewMode(kind: ManageEntityKind): ManageViewMode {
  return readStore<ManageViewMode>(VIEW_MODE_STORAGE_KEY)[kind] ?? DEFAULT_VIEW_MODE
}

export function saveManageViewMode(kind: ManageEntityKind, mode: ManageViewMode): void {
  const store: StoredManageViewMode = readStore<ManageViewMode>(VIEW_MODE_STORAGE_KEY)
  store[kind] = mode
  window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, JSON.stringify(store))
}
