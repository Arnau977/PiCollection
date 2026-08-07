/**
 * electron-updater's UpdateInfo.releaseNotes is a plain string in the common
 * case, but becomes an array of {version, note} when a user skips over
 * multiple releases at once. This app only ever shows the immediate next
 * version's notes, so it takes the first (most recent) entry and discards
 * the rest.
 */
export function normalizeReleaseNotes(
  releaseNotes: string | { version: string; note: string | null }[] | null | undefined
): string | null {
  if (!releaseNotes) return null
  if (typeof releaseNotes === 'string') return releaseNotes
  return releaseNotes[0]?.note ?? null
}
