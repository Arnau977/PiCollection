export type ManageSortProp = 'name' | 'createdAt'
export type ManageEntityKind = 'artists' | 'tags' | 'characters' | 'series'

export interface ManageSort {
  prop: ManageSortProp
  desc: boolean
}

const DEFAULT_SORT: ManageSort = { prop: 'name', desc: false }

export function sortManageEntities<T extends { name: string; createdAt?: number }>(
  items: T[],
  sort: ManageSort
): T[] {
  const factor = sort.desc ? -1 : 1
  return items.toSorted((a, b) => {
    if (sort.prop === 'createdAt') return ((a.createdAt ?? 0) - (b.createdAt ?? 0)) * factor
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * factor
  })
}

const STORAGE_KEY = 'picollection:manage-sort'

type StoredManageSort = Partial<Record<ManageEntityKind, ManageSort>>

function readStore(): StoredManageSort {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed
  } catch {
    return {}
  }
}

export function loadManageSort(kind: ManageEntityKind): ManageSort {
  return readStore()[kind] ?? DEFAULT_SORT
}

export function saveManageSort(kind: ManageEntityKind, sort: ManageSort): void {
  const store = readStore()
  store[kind] = sort
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}
