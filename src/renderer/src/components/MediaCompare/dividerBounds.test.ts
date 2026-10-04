import { describe, expect, it } from 'vitest'
import { dividerBounds, isOverImage } from './dividerBounds'

const stage = { width: 1000, height: 500 }
const square = { width: 500, height: 500 }
const unzoomed = { scale: 1, offsetX: 0 }

describe('dividerBounds', () => {
  it('keeps the divider over a letterboxed image', () => {
    expect(dividerBounds([square, square], stage, unzoomed)).toEqual({ min: 25, max: 75 })
  })

  it('spans the wider of two differently shaped images', () => {
    const wide = { width: 1600, height: 800 }
    expect(dividerBounds([square, wide], stage, unzoomed)).toEqual({ min: 0, max: 100 })
  })

  it('follows zoom and pan, never past the stage', () => {
    expect(dividerBounds([square], stage, { scale: 2, offsetX: -300 })).toEqual({
      min: 20,
      max: 100
    })
  })
})

describe('isOverImage', () => {
  const still = { scale: 1, offsetX: 0, offsetY: 0 }

  it('tells the letterbox apart from either image', () => {
    const wide = { width: 1000, height: 250 }
    expect(isOverImage({ x: 100, y: 250 }, [square, wide], stage, still)).toBe(true)
    expect(isOverImage({ x: 100, y: 50 }, [square, wide], stage, still)).toBe(false)
    expect(isOverImage({ x: 500, y: 50 }, [square, wide], stage, still)).toBe(true)
  })

  it('follows zoom and pan', () => {
    // 2x, panned so the square's left edge (250) lands at x=200.
    const zoomed = { scale: 2, offsetX: -300, offsetY: -250 }
    expect(isOverImage({ x: 150, y: 250 }, [square], stage, zoomed)).toBe(false)
    expect(isOverImage({ x: 250, y: 250 }, [square], stage, zoomed)).toBe(true)
  })

  it('counts as on an image until both sizes are known', () => {
    expect(isOverImage({ x: 0, y: 0 }, [square, undefined], stage, still)).toBe(true)
  })
})
