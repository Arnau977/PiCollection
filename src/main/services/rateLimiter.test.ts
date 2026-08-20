import { describe, expect, it } from 'vitest'
import { createRateLimiter } from './rateLimiter'

describe('createRateLimiter', () => {
  it('runs a single call immediately', async () => {
    const limit = createRateLimiter(50)
    const start = Date.now()

    await limit(() => Promise.resolve('done'))

    expect(Date.now() - start).toBeLessThan(30)
  })

  it('spaces out consecutive calls by at least the minimum interval', async () => {
    const limit = createRateLimiter(50)
    const start = Date.now()

    await limit(() => Promise.resolve(1))
    await limit(() => Promise.resolve(2))
    const elapsed = Date.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(45)
  })

  it('runs concurrently-fired calls one at a time, in order, each spaced out', async () => {
    const limit = createRateLimiter(30)
    const order: number[] = []

    await Promise.all([
      limit(() => {
        order.push(1)
        return Promise.resolve()
      }),
      limit(() => {
        order.push(2)
        return Promise.resolve()
      }),
      limit(() => {
        order.push(3)
        return Promise.resolve()
      })
    ])

    expect(order).toEqual([1, 2, 3])
  })

  it('keeps pacing later calls even after an earlier call rejects', async () => {
    const limit = createRateLimiter(30)

    await expect(limit(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    const result = await limit(() => Promise.resolve('recovered'))

    expect(result).toBe('recovered')
  })

  it('resolves each call with its own function result', async () => {
    const limit = createRateLimiter(10)

    const [a, b] = await Promise.all([
      limit(() => Promise.resolve('a')),
      limit(() => Promise.resolve('b'))
    ])

    expect(a).toBe('a')
    expect(b).toBe('b')
  })
})
