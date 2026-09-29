const KB = 1024
const MB = KB * 1024

/**
 * Human-readable size in the same 1024-based units Windows Explorer shows,
 * so the numbers match what the user sees in the file's folder.
 */
export function formatFileSize(bytes: number, locale: string): string {
  const [value, unit, digits] =
    bytes >= MB ? [bytes / MB, 'MB', 1] : bytes >= KB ? [bytes / KB, 'KB', 0] : [bytes, 'B', 0]
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)
  return `${number} ${unit}`
}

/**
 * Total size of the file behind an `app:` media URL. Asks for a single byte:
 * the protocol answers a range request with the full size in Content-Range,
 * so the file isn't read a second time just to be measured.
 */
export async function fetchFileSize(src: string): Promise<number | null> {
  try {
    const response = await fetch(src, { headers: { Range: 'bytes=0-0' } })
    const total = /\/(\d+)$/.exec(response.headers.get('Content-Range') ?? '')?.[1]
    await response.body?.cancel()
    return total ? Number(total) : null
  } catch {
    return null
  }
}
