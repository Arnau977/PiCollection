import { describe, expect, it } from 'vitest'
import { toMediaUrl, toThumbUrl } from './mediaUrl'

describe('toMediaUrl', () => {
  it('builds an app://media URL from a forward-slash path', () => {
    const url = toMediaUrl('/Users/jane/pic.png')
    expect(url).toBe('app://media//Users/jane/pic.png')
  })

  it('normalizes Windows backslash paths to forward slashes before encoding', () => {
    const url = toMediaUrl('C:\\Users\\jane\\pic.png')
    expect(url).toBe('app://media/C:/Users/jane/pic.png')
    expect(url).not.toContain('\\')
  })

  it('percent-encodes spaces in the path', () => {
    const url = toMediaUrl('/my pictures/pic (1).png')
    expect(url).toBe('app://media//my%20pictures/pic%20(1).png')
    expect(url).not.toContain(' ')
  })
})

describe('toThumbUrl', () => {
  it('points at the thumbnail host so a small cached preview is served', () => {
    expect(toThumbUrl('/Users/jane/pic.png')).toBe('app://thumb//Users/jane/pic.png')
  })

  it('normalizes and encodes the path the same way as the full-size URL', () => {
    expect(toThumbUrl('C:\\my pictures\\pic.png')).toBe('app://thumb/C:/my%20pictures/pic.png')
  })
})
