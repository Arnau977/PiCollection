import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export const MAX_LOG_FILE_BYTES = 2 * 1024 * 1024 // 2MB
export const MAX_LOG_FILES = 5 // app.log + app.1.log..app.4.log (~10MB total)

export function logsDir(): string {
  return join(app.getPath('userData'), 'logs')
}

export function currentLogFilePath(): string {
  return join(logsDir(), 'app.log')
}

function rotatedLogFilePath(index: number): string {
  return join(logsDir(), `app.${index}.log`)
}

/**
 * If the current log file has reached the size limit, shifts every rotated
 * file up by one index (dropping the oldest) and starts a fresh app.log.
 * Called periodically from the log-write buffer flush (roughly every
 * ROTATION_CHECK_INTERVAL_BYTES of buffered output, not on every write) so
 * the log directory only ever holds up to MAX_LOG_FILES files.
 */
export function rotateIfNeeded(): void {
  mkdirSync(logsDir(), { recursive: true })

  const current = currentLogFilePath()
  if (!existsSync(current)) return
  if (statSync(current).size < MAX_LOG_FILE_BYTES) return

  const oldestIndex = MAX_LOG_FILES - 1
  const oldest = rotatedLogFilePath(oldestIndex)
  if (existsSync(oldest)) rmSync(oldest)

  for (let i = oldestIndex - 1; i >= 1; i--) {
    const src = rotatedLogFilePath(i)
    if (existsSync(src)) renameSync(src, rotatedLogFilePath(i + 1))
  }

  renameSync(current, rotatedLogFilePath(1))
}
