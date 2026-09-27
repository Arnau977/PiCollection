import { fuzzyFilter } from './fuzzyMatch'

/** Forgiving (typo-, punctuation- and word-order-tolerant) match, best first - see fuzzyMatch.ts. */
export function filterByQuery<T>(items: T[], query: string, getLabel: (item: T) => string): T[] {
  return fuzzyFilter(items, query, getLabel)
}
