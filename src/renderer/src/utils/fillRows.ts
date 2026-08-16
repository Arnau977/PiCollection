/**
 * Given how many grid columns actually fit the container, decides how many
 * items to show so the last row is never partially filled - 2 rows when
 * that stays within a reasonable item count, 1 row otherwise (a wide window
 * already shows plenty in a single row without needing a second one).
 */
export function itemCountForColumns(columns: number, maxTwoRowItems = 16): number {
  if (columns <= 0) return 0
  const rows = columns * 2 <= maxTwoRowItems ? 2 : 1
  return columns * rows
}
