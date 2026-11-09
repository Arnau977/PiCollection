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
  it('lands under the limit in one retry on the measured clip, for each format', () => {
    // What the sandbox clip actually gave at 720 px against a 5 MB limit.
    const gif = retryWidth(720, 30.5, 5, 'gif')
    const webp = retryWidth(720, 8.3, 5, 'webp')
    expect(30.5 * (gif / 720) ** 1.6).toBeLessThan(5)
    expect(8.3 * (webp / 720) ** 1.15).toBeLessThan(5)
    // Its size follows the width less, so a WebP must go narrower for the same overshoot.
    expect(retryWidth(720, 20, 10, 'webp')).toBeLessThan(retryWidth(720, 20, 10, 'gif'))
  })

  it('still steps down at least 15% when barely over', () => {
    expect(retryWidth(720, 10.1, 10, 'webp')).toBe(612)
  })
})
