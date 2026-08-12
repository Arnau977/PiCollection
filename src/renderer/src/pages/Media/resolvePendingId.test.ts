import { describe, expect, it, vi } from 'vitest'
import { resolvePendingId } from './resolvePendingId'

interface Item {
  id: string
  name: string
}

describe('resolvePendingId', () => {
  it('returns the id unchanged when it is not a pending draft', async () => {
    const create = vi.fn()
    const result = await resolvePendingId<Item>('real-1', [], [{ id: 'real-1', name: 'cat' }], create)

    expect(result).toBe('real-1')
    expect(create).not.toHaveBeenCalled()
  })

  it('reuses an existing entity with the same name (case-insensitive) instead of creating', async () => {
    const create = vi.fn()
    const pending: Item[] = [{ id: 'temp-1', name: 'Landscape' }]
    const existing: Item[] = [{ id: 'real-9', name: 'landscape' }]

    const result = await resolvePendingId('temp-1', pending, existing, create)

    expect(result).toBe('real-9')
    expect(create).not.toHaveBeenCalled()
  })

  it('creates the entity when no existing match is found, and returns the new id', async () => {
    const create = vi.fn().mockResolvedValue({ success: true, data: { id: 'real-2', name: 'Sunset' } })
    const pending: Item[] = [{ id: 'temp-1', name: 'Sunset' }]

    const result = await resolvePendingId('temp-1', pending, [], create)

    expect(create).toHaveBeenCalledWith('Sunset')
    expect(result).toBe('real-2')
  })

  it('throws when creation fails', async () => {
    const create = vi.fn().mockResolvedValue({ success: false, error: { code: 'ERR', message: 'boom' } })
    const pending: Item[] = [{ id: 'temp-1', name: 'Sunset' }]

    await expect(resolvePendingId('temp-1', pending, [], create)).rejects.toThrow('boom')
  })
})
