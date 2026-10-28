import type { StorageBarItem } from './StorageBarList'

/** Size also orders by share of the library: one is the other over the same total. */
export type StorageSortProp = 'size' | 'count' | 'average' | 'name'

export interface StorageSort {
  prop: StorageSortProp
  desc: boolean
}

export const DEFAULT_STORAGE_SORT: StorageSort = { prop: 'size', desc: true }

const PROPS: StorageSortProp[] = ['size', 'count', 'average', 'name']

/** Picking a key starts in its natural order: heaviest/most first, names A to Z. */
export function naturalStorageSort(prop: StorageSortProp): StorageSort {
  return { prop, desc: prop !== 'name' }
}

export function parseStorageSort(prop: string | null, dir: string | null): StorageSort {
  if (!PROPS.includes(prop as StorageSortProp)) return DEFAULT_STORAGE_SORT
  const natural = naturalStorageSort(prop as StorageSortProp)
  return dir === 'asc' || dir === 'desc' ? { ...natural, desc: dir === 'desc' } : natural
}

/** A file on its own is one file. */
export function itemCount(item: StorageBarItem): number {
  return item.count ?? 1
}

/** The number a sort key ranks by - also what the list's bars measure (by name, the size). */
export function sortValue(item: StorageBarItem, prop: StorageSortProp): number {
  if (prop === 'count') return itemCount(item)
  if (prop === 'average') return item.bytes / itemCount(item)
  return item.bytes
}

/** Ties (same size or count) fall back to the name, so the order never jumps. */
export function sortStorageItems(items: StorageBarItem[], sort: StorageSort): StorageBarItem[] {
  const factor = sort.desc ? -1 : 1
  const byName = (a: StorageBarItem, b: StorageBarItem): number =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true })
  return items.toSorted((a, b) => {
    const key =
      sort.prop === 'name' ? byName(a, b) : sortValue(a, sort.prop) - sortValue(b, sort.prop)
    return key * factor || byName(a, b)
  })
}
