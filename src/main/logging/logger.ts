import { appendFileSync } from 'fs'
import { currentLogFilePath, rotateIfNeeded } from './rotation'
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

function writeLine(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  if (!readLoggingEnabled()) return
  try {
    rotateIfNeeded()
    const line = `${new Date().toISOString()} [${level}] [${scope}] ${message}${formatMeta(meta)}\n`
    appendFileSync(currentLogFilePath(), line, 'utf-8')
  } catch (err) {
    // Logging must never be the thing that crashes the app.
    console.warn('Could not write to debug log', err)
  }
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
