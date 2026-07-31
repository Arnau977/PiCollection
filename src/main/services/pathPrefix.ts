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
  for (let i = 0; i < first.length - 1; i += 1) {
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
