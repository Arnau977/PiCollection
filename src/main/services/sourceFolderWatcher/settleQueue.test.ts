import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSettleQueue } from './settleQueue'

const SETTLE_MS = 2000
const BATCH_MS = 3000

let sizes: Map<string, number>
const stat = async (path: string): Promise<{ size: number; mtimeMs: number }> => {
  const size = sizes.get(path)
  if (size === undefined) throw new Error('ENOENT')
  return { size, mtimeMs: 1 }
}

beforeEach(() => {
  vi.useFakeTimers()
  sizes = new Map()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createSettleQueue', () => {
  it('waits for a file to settle', async () => {
    const process = vi.fn().mockResolvedValue(undefined)
    const queue = createSettleQueue({ settleMs: SETTLE_MS, batchMs: BATCH_MS, process, stat })
    sizes.set('a.png', 10)
    queue.add('a.png')

    // Still growing on every check: never handed over.
    for (let i = 0; i < 4; i++) {
      sizes.set('a.png', 10 + i * 10)
      await vi.advanceTimersByTimeAsync(SETTLE_MS)
    }
    expect(process).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(SETTLE_MS * 2 + BATCH_MS)
    expect(process).toHaveBeenCalledWith(['a.png'])
    queue.stop()
  })

  it('ignores partial-download names', async () => {
    const process = vi.fn().mockResolvedValue(undefined)
    const queue = createSettleQueue({ settleMs: SETTLE_MS, batchMs: BATCH_MS, process, stat })
    for (const name of ['x.crdownload', 'y.part', 'z.tmp', '~$a.png']) {
      sizes.set(name, 1)
      queue.add(name)
    }

    await vi.advanceTimersByTimeAsync(SETTLE_MS * 3 + BATCH_MS * 2)
    expect(process).not.toHaveBeenCalled()
    queue.stop()
  })

  it('processes one batch at a time and reports a single total', async () => {
    let active = 0
    let maxActive = 0
    const seen: string[] = []
    const process = vi.fn(async (paths: string[]) => {
      active++
      maxActive = Math.max(maxActive, active)
      seen.push(...paths)
      await new Promise((resolve) => setTimeout(resolve, BATCH_MS * 3))
      active--
    })
    const queue = createSettleQueue({ settleMs: SETTLE_MS, batchMs: BATCH_MS, process, stat })
    for (let i = 0; i < 300; i++) {
      sizes.set(`f${i}.png`, 5)
      queue.add(`f${i}.png`)
    }

    await vi.advanceTimersByTimeAsync(SETTLE_MS * 3 + BATCH_MS * 10)
    expect(maxActive).toBe(1)
    expect(seen).toHaveLength(300)
    expect(new Set(seen).size).toBe(300)
    queue.stop()
  })

  it('drops a file that disappears before it settles', async () => {
    const process = vi.fn().mockResolvedValue(undefined)
    const queue = createSettleQueue({ settleMs: SETTLE_MS, batchMs: BATCH_MS, process, stat })
    sizes.set('gone.png', 3)
    queue.add('gone.png')
    sizes.delete('gone.png')

    await vi.advanceTimersByTimeAsync(SETTLE_MS * 3 + BATCH_MS)
    expect(process).not.toHaveBeenCalled()
    queue.stop()
  })
})
