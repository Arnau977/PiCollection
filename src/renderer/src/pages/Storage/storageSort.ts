import type { StorageBarItem } from './StorageBarList'

/** Size also orders by share of the library: one is the other over the same total. */
export type StorageSortProp = 'size' | 'count' | 'name'

export interface StorageSort {
  prop: StorageSortProp
  desc: boolean
}

export const DEFAULT_STORAGE_SORT: StorageSort = { prop: 'size', desc: true }

/** Picking a key starts in its natural order: heaviest/most first, names A to Z. */
export function naturalStorageSort(prop: StorageSortProp): StorageSort {
  return { prop, desc: prop !== 'name' }
}

export function parseStorageSort(prop: string | null, dir: string | null): StorageSort {
  if (prop !== 'size' && prop !== 'count' && prop !== 'name') return DEFAULT_STORAGE_SORT
  const natural = naturalStorageSort(prop)
  return dir === 'asc' || dir === 'desc' ? { prop, desc: dir === 'desc' } : natural
}

/** A file on its own is one file. */
export function itemCount(item: StorageBarItem): number {
  return item.count ?? 1
}

/** Ties (same size or count) fall back to the name, so the order never jumps. */
export function sortStorageItems(items: StorageBarItem[], sort: StorageSort): StorageBarItem[] {
  const factor = sort.desc ? -1 : 1
  const byName = (a: StorageBarItem, b: StorageBarItem): number =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true })
  return items.toSorted((a, b) => {
    const key =
      sort.prop === 'size'
        ? a.bytes - b.bytes
        : sort.prop === 'count'
          ? itemCount(a) - itemCount(b)
          : byName(a, b)
    return key * factor || byName(a, b)
  })
}
