import { describe, expect, it } from 'vitest'
import { canFallBackToOriginal, thumbnailCacheKey } from './thumbnailCache'

describe('thumbnailCacheKey', () => {
  it('is stable for the same file', () => {
    expect(thumbnailCacheKey('/a.png', 1000, 50, 480)).toBe(
      thumbnailCacheKey('/a.png', 1000, 50, 480)
    )
  })

  it('changes when the file is modified, so stale previews are not served', () => {
    const before = thumbnailCacheKey('/a.png', 1000, 50, 480)
    const afterTouch = thumbnailCacheKey('/a.png', 2000, 50, 480)
    const afterResize = thumbnailCacheKey('/a.png', 1000, 99, 480)

    expect(afterTouch).not.toBe(before)
    expect(afterResize).not.toBe(before)
  })

  it('changes when a different thumbnail size is requested', () => {
    expect(thumbnailCacheKey('/a.png', 1000, 50, 480)).not.toBe(
      thumbnailCacheKey('/a.png', 1000, 50, 200)
    )
  })

  it('differs between files', () => {
    expect(thumbnailCacheKey('/a.png', 1000, 50, 480)).not.toBe(
      thumbnailCacheKey('/b.png', 1000, 50, 480)
    )
  })

  it('produces a filesystem-safe name', () => {
    expect(thumbnailCacheKey('C:\\pics\\a b.png', 1000, 50, 480)).toMatch(/^[a-f0-9]+$/)
  })
})

describe('canFallBackToOriginal', () => {
  it('allows serving the original for static image formats the browser can scale', () => {
    expect(canFallBackToOriginal('.png')).toBe(true)
    expect(canFallBackToOriginal('.JPG')).toBe(true)
  })

  it('refuses for videos, which would stall an <img> if streamed in full', () => {
    expect(canFallBackToOriginal('.mp4')).toBe(false)
    expect(canFallBackToOriginal('.webm')).toBe(false)
  })

  it('refuses for gifs, which would animate immediately instead of waiting for hover', () => {
    expect(canFallBackToOriginal('.gif')).toBe(false)
    expect(canFallBackToOriginal('.GIF')).toBe(false)
  })

  it('refuses for unknown extensions', () => {
    expect(canFallBackToOriginal('.bin')).toBe(false)
    expect(canFallBackToOriginal('')).toBe(false)
  })
})
