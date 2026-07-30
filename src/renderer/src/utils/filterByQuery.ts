export function filterByQuery<T>(items: T[], query: string, getLabel: (item: T) => string): T[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return items
  return items.filter((item) => getLabel(item).toLowerCase().includes(trimmed))
}
