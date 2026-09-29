import { describe, expect, it } from 'vitest'
import { dividerBounds } from './dividerBounds'

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
