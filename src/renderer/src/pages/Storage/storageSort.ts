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

export function averageSize(item: StorageBarItem): number {
  return item.bytes / itemCount(item)
}

/**
 * How many files of the library's average size every entry starts with when
 * ranked by average. A bayesian average, as in rating charts: with many
 * files an entry ranks by its own average, with one or two it is pulled
 * toward the library's, so a single heavy file doesn't top the list.
 */
export const AVERAGE_PRIOR_FILES = 5

/**
 * The number a sort key ranks by - also what the list's bars measure (by
 * name, the size). `meanBytes` is the library's average file size.
 */
export function sortValue(item: StorageBarItem, prop: StorageSortProp, meanBytes = 0): number {
  if (prop === 'count') return itemCount(item)
  if (prop === 'average') {
    return (item.bytes + AVERAGE_PRIOR_FILES * meanBytes) / (itemCount(item) + AVERAGE_PRIOR_FILES)
  }
  return item.bytes
}

/** Ties (same size or count) fall back to the name, so the order never jumps. */
export function sortStorageItems(
  items: StorageBarItem[],
  sort: StorageSort,
  meanBytes = 0
): StorageBarItem[] {
  const factor = sort.desc ? -1 : 1
  const byName = (a: StorageBarItem, b: StorageBarItem): number =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true })
  return items.toSorted((a, b) => {
    const key =
      sort.prop === 'name'
        ? byName(a, b)
        : sortValue(a, sort.prop, meanBytes) - sortValue(b, sort.prop, meanBytes)
    return key * factor || byName(a, b)
  })
}
