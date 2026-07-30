import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { IpcMainInvokeEvent } from 'electron'
import { ipcHandler } from './helpers'

const fakeEvent = {} as IpcMainInvokeEvent

describe('ipcHandler', () => {
  it('returns a success envelope when input is valid and the handler resolves', async () => {
    const schema = z.object({ id: z.string() })
    const handler = ipcHandler(schema, async (input) => ({ echoed: input.id }))

    const result = await handler(fakeEvent, { id: 'abc' })

    expect(result).toEqual({ success: true, data: { echoed: 'abc' } })
  })

  it('returns a validation error envelope when input does not match the schema', async () => {
    const schema = z.object({ id: z.string() })
    const handler = ipcHandler(schema, async (input) => ({ echoed: input.id }))

    const result = await handler(fakeEvent, { id: 123 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION')
    }
  })

  it('returns an internal error envelope when the handler function throws', async () => {
    const schema = z.void()
    const handler = ipcHandler(schema, async () => {
      throw new Error('boom')
    })

    const result = await handler(fakeEvent, undefined)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL')
      expect(result.error.message).toBe('boom')
    }
  })

  it('returns a friendly duplicate error when a unique constraint fails', async () => {
    const schema = z.void()
    const handler = ipcHandler(schema, async () => {
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
