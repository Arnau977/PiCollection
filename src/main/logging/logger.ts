import { appendFileSync, mkdirSync } from 'fs'
import { currentLogFilePath, logsDir, rotateIfNeeded } from './rotation'
import { readLoggingEnabled } from './loggingSettings'

type LogLevel = 'INFO' | 'WARN' | 'ERROR'

function formatMeta(meta: unknown): string {
  if (meta === undefined) return ''
  if (meta instanceof Error) {
    return ` ${JSON.stringify({ message: meta.message, stack: meta.stack })}`
  }
  try {
    return ` ${JSON.stringify(meta)}`
  } catch {
    return ` ${String(meta)}`
  }
}

const FLUSH_INTERVAL_MS = 250
// Checked well before MAX_LOG_FILE_BYTES so a burst of writes between two
// checks can never blow well past the limit before rotation catches it.
const ROTATION_CHECK_INTERVAL_BYTES = 64 * 1024

let buffer = ''
let flushTimer: NodeJS.Timeout | undefined
let bytesSinceRotationCheck = 0

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    flushLogBuffer()
  }, FLUSH_INTERVAL_MS)
}

/** Writes any buffered log lines to disk immediately. Called on the flush timer, and on shutdown/crash so nothing buffered is lost. */
export function flushLogBuffer(): void {
  if (!buffer) return
  const toWrite = buffer
  buffer = ''
  try {
    // Not cached behind a "did this already" flag: logsDir() is derived from
    // Electron's userData path, and mkdirSync with recursive:true is a cheap
    // no-op when the directory already exists - matching rotateIfNeeded(),
    // which also calls mkdirSync unconditionally on every invocation.
    mkdirSync(logsDir(), { recursive: true })
    bytesSinceRotationCheck += toWrite.length
    if (bytesSinceRotationCheck >= ROTATION_CHECK_INTERVAL_BYTES) {
      bytesSinceRotationCheck = 0
      rotateIfNeeded()
    }
    appendFileSync(currentLogFilePath(), toWrite)
  } catch (err) {
    // Logging must never be the thing that crashes the app.
    console.warn('Could not write to debug log', err)
  }
}

function writeLine(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  if (!readLoggingEnabled()) return
  buffer += `${new Date().toISOString()} [${level}] [${scope}] ${message}${formatMeta(meta)}\n`
  scheduleFlush()
}

export function logInfo(scope: string, message: string, meta?: Record<string, unknown>): void {
  writeLine('INFO', scope, message, meta)
}

export function logWarn(scope: string, message: string, meta?: Record<string, unknown>): void {
  writeLine('WARN', scope, message, meta)
}

export function logError(scope: string, message: string, err?: unknown): void {
  writeLine('ERROR', scope, message, err)
}
