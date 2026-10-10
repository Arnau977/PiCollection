import { describe, expect, it } from 'vitest'
import { ditherToPalette } from './ditherToPalette'

function solid(width: number, height: number, [r, g, b]: number[]): Uint8Array {
  const rgba = new Uint8Array(width * height * 4)
  for (let p = 0; p < rgba.length; p += 4) rgba.set([r, g, b, 255], p)
  return rgba
}

describe('ditherToPalette', () => {
  it('maps a color that is in the palette straight to it, with no noise', () => {
    const index = ditherToPalette(solid(8, 8, [10, 200, 30]), 8, 8, [
      [0, 0, 0],
      [10, 200, 30]
    ])

    expect(index.every((i) => i === 1)).toBe(true)
  })

  it('renders a shade between two palette colors as a mix of both', () => {
    const index = ditherToPalette(solid(16, 16, [128, 128, 128]), 16, 16, [
      [0, 0, 0],
      [255, 255, 255]
    ])

    const white = index.filter((i) => i === 1).length / index.length
    expect(white).toBeGreaterThan(0.4)
    expect(white).toBeLessThan(0.6)
  })
})
