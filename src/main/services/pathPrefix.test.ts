import { describe, expect, it } from 'vitest'
import { findCommonPathPrefix } from './pathPrefix'

describe('findCommonPathPrefix', () => {
  it('returns null for an empty list', () => {
    expect(findCommonPathPrefix([])).toBeNull()
  })

  it('returns the containing folder for a single path', () => {
    expect(findCommonPathPrefix(['C:\\Pics\\a.png'])).toBe('C:\\Pics\\')
  })

  it('finds the shared folder for paths in the same directory', () => {
    expect(findCommonPathPrefix(['C:\\Pics\\sub\\a.png', 'C:\\Pics\\sub\\b.png'])).toBe(
      'C:\\Pics\\sub\\'
    )
  })

  it('stops at the last shared directory when paths diverge into sibling folders', () => {
    expect(findCommonPathPrefix(['C:\\Pics\\sub1\\a.png', 'C:\\Pics\\sub2\\b.png'])).toBe(
      'C:\\Pics\\'
    )
  })

  it('returns null when paths share no directory at all', () => {
    expect(findCommonPathPrefix(['C:\\Pics\\a.png', 'D:\\Other\\b.png'])).toBeNull()
  })

  it('works with forward-slash paths', () => {
    expect(findCommonPathPrefix(['/home/user/pics/a.png', '/home/user/pics/b.png'])).toBe(
      '/home/user/pics/'
    )
  })

  it('handles paths with different segment counts (longer first, shorter second)', () => {
    expect(findCommonPathPrefix(['C:\\Pics\\sub\\a.png', 'C:\\Pics\\sub'])).toBe('C:\\Pics\\')
  })

  it('handles paths with different segment counts (shorter first, longer second)', () => {
    expect(findCommonPathPrefix(['C:\\Pics\\sub', 'C:\\Pics\\sub\\a.png'])).toBe('C:\\Pics\\')
  })
})
