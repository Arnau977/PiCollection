function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "DD/MM/YYYY" - a fixed format regardless of the OS/browser's own locale settings. */
export function formatDate(epochMs: number): string {
  const d = new Date(epochMs)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** "DD/MM/YYYY, HH:MM" (24h) - same fixed date format, plus the time, for a hover tooltip. */
export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs)
  return `${formatDate(epochMs)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * "3 hours ago" / "tomorrow" / "in 6 days" in the given UI language - for
 * the rough "last/next" timing of a scheduled task, where an exact date
 * would be noise. Picks the largest unit that keeps the number >= 1.
 */
export function formatRelativeTime(epochMs: number, now: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diff = epochMs - now
  const abs = Math.abs(diff)
  if (abs < MINUTE_MS) return rtf.format(0, 'second')
  if (abs < HOUR_MS) return rtf.format(Math.round(diff / MINUTE_MS), 'minute')
  if (abs < DAY_MS) return rtf.format(Math.round(diff / HOUR_MS), 'hour')
  return rtf.format(Math.round(diff / DAY_MS), 'day')
}
