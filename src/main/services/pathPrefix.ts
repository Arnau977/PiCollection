import { sep } from 'path'

/**
 * Guarantees `dir` ends in a path separator, so it can be safely used both as
 * a prefix test (a bare `D:\Art` would otherwise also match `D:\Artwork\...`)
 * and as a concatenation base (`newRoot + remainder` would otherwise produce
 * `E:\Newa.png`). Reuses whichever separator style the string already uses so
 * a hand-typed POSIX path doesn't get a stray backslash on Windows.
 */
export function withTrailingSeparator(dir: string): string {
  if (/[/\\]$/.test(dir)) return dir
  if (dir.includes('\\')) return dir + '\\'
  if (dir.includes('/')) return dir + '/'
  return dir + sep
}

/**
 * The longest directory prefix shared by every path, used to suggest the
 * "old root" when relinking media whose files moved - e.g. given several
 * routes all starting with `D:\Old\`, that's very likely the folder the
 * user renamed or moved, not something they should have to type by hand.
 * Never returns a prefix that cuts through a filename: the last path
 * segment of each input is always excluded from the comparison.
 */
export function findCommonPathPrefix(paths: string[]): string | null {
  if (paths.length === 0) return null

  const splitPath = (p: string): string[] => p.split(/[/\\]/)
  const segmentLists = paths.map(splitPath)
  const first = segmentLists[0]

  let commonLength = 0
  const minLength = Math.min(...segmentLists.map((s) => s.length)) - 1
  for (let i = 0; i < minLength; i += 1) {
    if (segmentLists.every((segments) => segments[i] === first[i])) {
      commonLength = i + 1
    } else {
      break
    }
  }

  if (commonLength === 0) return null

  const separator = paths[0].includes('\\') ? '\\' : '/'
  return first.slice(0, commonLength).join(separator) + separator
}

/**
 * Windows and macOS treat filesystem paths case-insensitively; Linux does
 * not. Every prefix/subtree check in this app follows the host filesystem's
 * rule, decided in exactly this one place.
 */
export const CASE_INSENSITIVE_PATHS = process.platform !== 'linux'

/**
 * Whether `path` lives inside `root` (or is a file directly under it).
 * Used both to relativize a route when it's saved and to decide whether a
 * relinked file still belongs to the same root.
 */
export function isPathUnderRoot(path: string, root: string): boolean {
  const normalizedRoot = withTrailingSeparator(root)
  if (CASE_INSENSITIVE_PATHS) {
    return path.toLowerCase().startsWith(normalizedRoot.toLowerCase())
  }
  return path.startsWith(normalizedRoot)
}
