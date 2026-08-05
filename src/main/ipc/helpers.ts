import type { IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'
import type { IpcResult } from '@shared/ipc/contracts'
import { AppError } from '../errors'
import { logError, logInfo } from '../logging/logger'

const UNIQUE_CONSTRAINT_RE = /UNIQUE constraint failed: (\w+)\.(\w+)/

function toFriendlyError(err: unknown): { code: string; message: string } {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message }
  }
  const message = err instanceof Error ? err.message : String(err)
  const uniqueMatch = message.match(UNIQUE_CONSTRAINT_RE)
  if (uniqueMatch) {
    const [, , column] = uniqueMatch
    return { code: 'DUPLICATE', message: `That ${column} is already in use.` }
  }
  return { code: 'INTERNAL', message }
}

export function ipcHandler<TSchema extends z.ZodTypeAny, TOut>(
  channel: string,
  schema: TSchema,
  fn: (input: z.infer<TSchema>) => Promise<TOut>
) {
  return async (_event: IpcMainInvokeEvent, rawInput: unknown): Promise<IpcResult<TOut>> => {
    const startedAt = Date.now()
    const parsed = schema.safeParse(rawInput)
    if (!parsed.success) {
      logError('ipc', channel, parsed.error)
      return { success: false, error: { code: 'VALIDATION', message: parsed.error.message } }
    }
    try {
      const data = await fn(parsed.data)
      logInfo('ipc', channel, { ms: Date.now() - startedAt })
      return { success: true, data }
    } catch (err) {
      logError('ipc', channel, err)
      return { success: false, error: toFriendlyError(err) }
    }
  }
}
