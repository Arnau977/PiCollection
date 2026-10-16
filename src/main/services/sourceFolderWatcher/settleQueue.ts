import { promises as fs } from 'fs'
import { basename } from 'path'

interface FileSnapshot {
  size: number
  mtimeMs: number
}

export interface SettleQueueOptions {
  /** A file is ready once its size and mtime match across two checks this far apart. */
  settleMs: number
  /** How often ready files are handed over, as one batch. */
  batchMs: number
  process: (paths: string[]) => Promise<void>
  /** Injectable for tests. */
  stat?: (path: string) => Promise<FileSnapshot>
}

const PARTIAL_SUFFIXES = ['.crdownload', '.part', '.tmp']

/** Browser downloads in progress and Office lock files - never media. */
function isPartialName(path: string): boolean {
  const name = basename(path).toLowerCase()
  return name.startsWith('~$') || PARTIAL_SUFFIXES.some((suffix) => name.endsWith(suffix))
}

/**
 * Collects paths reported by the watcher and hands them over only once the
 * file has stopped changing (a download or copy still being written would be
 * hashed half-done), in batches, one batch at a time - copying hundreds of
 * files in is one sequential pass, not hundreds of concurrent ones.
 */
export function createSettleQueue(options: SettleQueueOptions): {
  add: (path: string) => void
  stop: () => void
} {
  const stat = options.stat ?? ((path: string): Promise<FileSnapshot> => fs.stat(path))
  /** Waiting to settle: the last snapshot seen, or null before the first check. */
  const settling = new Map<string, FileSnapshot | null>()
  const ready = new Set<string>()
  let processing = false
  let checking = false

  async function checkSettling(): Promise<void> {
    if (checking) return
    checking = true
    try {
      for (const [path, previous] of [...settling]) {
        let current: FileSnapshot
        try {
          const { size, mtimeMs } = await stat(path)
          current = { size, mtimeMs }
        } catch {
          settling.delete(path) // gone (renamed again, deleted): nothing to do
          continue
        }
        if (previous && previous.size === current.size && previous.mtimeMs === current.mtimeMs) {
          settling.delete(path)
          ready.add(path)
        } else {
          settling.set(path, current)
        }
      }
    } finally {
      checking = false
    }
  }

  function flush(): void {
    if (processing || ready.size === 0) return
    const batch = [...ready]
    ready.clear()
    processing = true
    options
      .process(batch)
      .catch(() => undefined)
      .finally(() => {
        processing = false
      })
  }

  const settleTimer = setInterval(() => void checkSettling(), options.settleMs)
  const batchTimer = setInterval(flush, options.batchMs)
  settleTimer.unref?.()
  batchTimer.unref?.()

  return {
    add(path: string): void {
      if (isPartialName(path) || ready.has(path)) return
      // A new event restarts the wait: the file is still being written.
      settling.set(path, null)
    },
    stop(): void {
      clearInterval(settleTimer)
      clearInterval(batchTimer)
      settling.clear()
      ready.clear()
    }
  }
}
