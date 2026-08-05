import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { IpcMainInvokeEvent } from 'electron'

vi.mock('../logging/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn()
}))

const { ipcHandler } = await import('./helpers')
const { logInfo, logError } = await import('../logging/logger')

const fakeEvent = {} as IpcMainInvokeEvent

describe('ipcHandler', () => {
  it('returns a success envelope when input is valid and the handler resolves', async () => {
    const schema = z.object({ id: z.string() })
    const handler = ipcHandler('test:echo', schema, async (input) => ({ echoed: input.id }))

    const result = await handler(fakeEvent, { id: 'abc' })

    expect(result).toEqual({ success: true, data: { echoed: 'abc' } })
  })

  it('logs the channel name on success', async () => {
    const schema = z.void()
    const handler = ipcHandler('test:echo', schema, async () => undefined)

    await handler(fakeEvent, undefined)

    expect(logInfo).toHaveBeenCalledWith('ipc', 'test:echo', expect.objectContaining({ ms: expect.any(Number) }))
  })

  it('returns a validation error envelope when input does not match the schema', async () => {
    const schema = z.object({ id: z.string() })
    const handler = ipcHandler('test:echo', schema, async (input) => ({ echoed: input.id }))

    const result = await handler(fakeEvent, { id: 123 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION')
    }
    expect(logError).toHaveBeenCalledWith('ipc', 'test:echo', expect.anything())
  })

  it('returns an internal error envelope when the handler function throws', async () => {
    const schema = z.void()
    const handler = ipcHandler('test:boom', schema, async () => {
      throw new Error('boom')
    })

    const result = await handler(fakeEvent, undefined)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL')
      expect(result.error.message).toBe('boom')
    }
    expect(logError).toHaveBeenCalledWith('ipc', 'test:boom', expect.any(Error))
  })

  it('returns a friendly duplicate error when a unique constraint fails', async () => {
    const schema = z.void()
    const handler = ipcHandler('test:dup', schema, async () => {
      throw new Error('UNIQUE constraint failed: tag.name')
    })

    const result = await handler(fakeEvent, undefined)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('DUPLICATE')
      expect(result.error.message).toBe('That name is already in use.')
    }
  })
})
