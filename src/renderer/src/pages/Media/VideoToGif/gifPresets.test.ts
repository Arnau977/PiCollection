import { describe, expect, it } from 'vitest'
import { frameDelays } from './gifPresets'

describe('frameDelays', () => {
  it('keeps the real duration when the frame rate is not a whole number of hundredths', () => {
    const delays = frameDelays(30, 30)

    expect(delays.reduce((sum, delay) => sum + delay, 0)).toBe(1000)
    expect(new Set(delays)).toEqual(new Set([30, 40]))
  })
})
