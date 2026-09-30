/**
 * A media route's file name and folder - what the edit form's Location shows,
 * and how the similar-media list names each match so the two read the same
 * (a capture's file name carries a timestamp prefix its media name doesn't).
 */
export function splitRoute(route: string): { fileName: string; folder: string } {
  const lastSeparator = Math.max(route.lastIndexOf('/'), route.lastIndexOf('\\'))
  return {
    fileName: route.slice(lastSeparator + 1),
    folder: lastSeparator > 0 ? route.slice(0, lastSeparator) : ''
  }
}
