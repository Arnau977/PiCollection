import { describe, expect, it } from 'vitest'
import { frameDelays, retryWidth } from './gifPresets'

describe('frameDelays', () => {
  it('keeps the real duration when the frame rate is not a whole number of hundredths', () => {
    const delays = frameDelays(30, 30)

    expect(delays.reduce((sum, delay) => sum + delay, 0)).toBe(1000)
    expect(new Set(delays)).toEqual(new Set([30, 40]))
  })
})

describe('retryWidth', () => {
  it('jumps to a width that fits from how far over it went, at least 15% narrower', () => {
    // 4x the limit: half the width gives a quarter of the pixels, less the margin.
    expect(retryWidth(720, 40, 10)).toBe(342)
    // Barely over: still a real step down, not 1 px.
    expect(retryWidth(720, 10.1, 10)).toBe(612)
  })
})
