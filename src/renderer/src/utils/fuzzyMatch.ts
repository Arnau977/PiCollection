/**
 * Forgiving name matching for entity pickers and search suggestions: case,
 * accents, underscores, parentheses and punctuation are ignored, words can
 * come in any order, and small typos are tolerated. Names like
 * "Pyra (Xenoblade)" are tedious to type exactly, so "pyra xenoblade",
 * "xenoblade pyra" and "pira" all find it.
 */

/** Lowercase, accents stripped, anything that isn't a letter/digit turned into a single space. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Optimal string alignment distance: Levenshtein plus adjacent transpositions ("pyar" -> "pyra" is 1). */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)]
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, rows[i - 2][j - 2] + 1)
      }
      row.push(value)
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin > max) return max + 1
    rows.push(row)
  }
  return rows[a.length][b.length]
}

/** Short words must be exact - one typo in a 3-letter word matches half the library. */
function allowedTypos(word: string): number {
  if (word.length <= 3) return 0
  if (word.length <= 7) return 1
  return 2
}

/**
 * Typos allowed for one query word against the label's words, or null if it
 * matches none. Also compares against each label word's prefix, so a
 * half-typed word with a typo ("mytr" for "mythra") still counts.
 */
function wordTypos(queryWord: string, labelWords: string[]): number | null {
  const max = allowedTypos(queryWord)
  let best: number | null = null
  for (const labelWord of labelWords) {
    if (labelWord.includes(queryWord)) return 0
    if (max === 0) continue
    const whole = editDistance(queryWord, labelWord, max)
    const prefix =
      labelWord.length > queryWord.length
        ? editDistance(queryWord, labelWord.slice(0, queryWord.length), max)
        : whole
    const distance = Math.min(whole, prefix)
    if (distance <= max && (best === null || distance < best)) best = distance
  }
  return best
}

/**
 * How well `label` matches `query`: higher is better, null means no match.
 * Exact beats prefix beats substring beats "every word found in any order"
 * beats typo matches (fewer typos first).
 */
export function fuzzyScore(label: string, query: string): number | null {
  const q = normalizeForMatch(query)
  if (!q) return 0
  const l = normalizeForMatch(label)
  if (!l) return null

  if (l === q) return 1000
  if (l.startsWith(q)) return 900
  const labelWords = l.split(' ')
  if (labelWords.some((word) => word.startsWith(q))) return 800
  if (l.includes(q)) return 700

  let typos = 0
  for (const queryWord of q.split(' ')) {
    const wordResult = wordTypos(queryWord, labelWords)
    if (wordResult === null) return null
    typos += wordResult
  }
  return typos === 0 ? 600 : 500 - typos * 50
}

/** Items matching `query`, best match first; ties keep their original order. */
export function fuzzyFilter<T>(items: T[], query: string, getLabel: (item: T) => string): T[] {
  if (!normalizeForMatch(query)) return items
  return items
    .map((item, index) => ({ item, index, score: fuzzyScore(getLabel(item), query) }))
    .filter((entry): entry is { item: T; index: number; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item)
}
