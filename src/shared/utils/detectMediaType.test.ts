import { describe, expect, it } from 'vitest'
import { detectMediaType } from './detectMediaType'

describe('detectMediaType', () => {
  it('detects video from mime type', () => {
    expect(detectMediaType({ type: 'video/mp4', name: 'clip.mp4' })).toBe('video')
  })

  it('detects gif from mime type', () => {
    expect(detectMediaType({ type: 'image/gif', name: 'anim.gif' })).toBe('gif')
  })

  it('detects gif from file extension when mime type is generic', () => {
    expect(detectMediaType({ type: '', name: 'anim.GIF' })).toBe('gif')
  })

  it('defaults to image for other image mime types', () => {
    expect(detectMediaType({ type: 'image/png', name: 'pic.png' })).toBe('image')
  })

  it('defaults to image when the type is unrecognized', () => {
    expect(detectMediaType({ type: 'application/octet-stream', name: 'file.bin' })).toBe('image')
  })
})
