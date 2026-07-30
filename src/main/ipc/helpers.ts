import type { IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'
import type { IpcResult } from '@shared/ipc/contracts'

const UNIQUE_CONSTRAINT_RE = /UNIQUE constraint failed: (\w+)\.(\w+)/

function toFriendlyError(err: unknown): { code: string; message: string } {
  const message = err instanceof Error ? err.message : String(err)
  const uniqueMatch = message.match(UNIQUE_CONSTRAINT_RE)
  if (uniqueMatch) {
    const [, , column] = uniqueMatch
    return { code: 'DUPLICATE', message: `That ${column} is already in use.` }
  }
  return { code: 'INTERNAL', message }
}

export function ipcHandler<TSchema extends z.ZodTypeAny, TOut>(
  schema: TSchema,
  fn: (input: z.infer<TSchema>) => Promise<TOut>
) {
  return async (_event: IpcMainInvokeEvent, rawInput: unknown): Promise<IpcResult<TOut>> => {
    const parsed = schema.safeParse(rawInput)
    if (!parsed.success) {
      return { success: false, error: { code: 'VALIDATION', message: parsed.error.message } }
    }
    try {
      const data = await fn(parsed.data)
      return { success: true, data }
    } catch (err) {
      return { success: false, error: toFriendlyError(err) }
    }
  }
}
