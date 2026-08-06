const UNITS: [number, string][] = [
  [1_000_000, 'M'],
  [1_000, 'k']
]

/** "984" / "5.9k" / "29k" / "1.5M" - Danbooru-style compact counts. */
export function formatCompactCount(count: number): string {
  for (const [threshold, suffix] of UNITS) {
    if (count >= threshold) {
      const scaled = count / threshold
      const rounded = scaled >= 100 ? Math.round(scaled) : Math.round(scaled * 10) / 10
      return `${rounded}${suffix}`
    }
  }
  return String(count)
}
