/**
 * Compares two `X.Y.Z` version strings numerically, ignoring any
 * prerelease suffix (e.g. `1.4.0-beta.1` compares equal to `1.4.0`) - this
 * app's own versioning rule is plain `X.Y.Z` always (see
 * docs/auto-update.md), a prerelease/channel is decided by GitHub's release
 * flag, not encoded in the number. Returns a negative number if `a` is
 * older than `b`, positive if newer, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = toParts(a)
  const partsB = toParts(b)

  for (let i = 0; i < 3; i++) {
    const diff = partsA[i] - partsB[i]
    if (diff !== 0) return diff
  }
  return 0
}

function toParts(version: string): [number, number, number] {
  const numeric = version.split('-')[0]
  const [major, minor, patch] = numeric.split('.').map((n) => Number.parseInt(n, 10) || 0)
  return [major || 0, minor || 0, patch || 0]
}
