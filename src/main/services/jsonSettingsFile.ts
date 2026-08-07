import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface JsonSettingsFile<T> {
  read(): T
  write(value: T): void
  /** Test-only: clears the in-module cache so a fresh per-test userData dir isn't shadowed. */
  invalidate(): void
}

/**
 * Read-parse-with-default / write-with-catch, cached in module scope after
 * the first read so a hot path (e.g. a check on every IPC call) is a cheap
 * in-memory return, not a synchronous file read. `parse` receives whatever
 * `JSON.parse` produced (or corrupted/missing input never reaches it - both
 * fall back to `defaultValue` directly) and narrows it into `T`.
 */
export function createJsonSettingsFile<T>(
  fileName: string,
  parse: (raw: unknown) => T,
  defaultValue: T
): JsonSettingsFile<T> {
  const filePath = (): string => join(app.getPath('userData'), fileName)
  let cached: T | undefined

  return {
    read(): T {
      if (cached !== undefined) return cached
      try {
        cached = parse(JSON.parse(readFileSync(filePath(), 'utf-8')))
      } catch {
        // Missing or corrupted settings are expected on first run.
        cached = defaultValue
      }
      return cached
    },
    write(value: T): void {
      try {
        writeFileSync(filePath(), JSON.stringify(value), 'utf-8')
        cached = value
      } catch (err) {
        console.warn(`Could not persist ${fileName}`, err)
      }
    },
    invalidate(): void {
      cached = undefined
    }
  }
}
