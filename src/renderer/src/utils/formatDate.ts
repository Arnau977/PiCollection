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
