import { describe, expect, it } from 'vitest'
import { findCommonPathPrefix, isPathUnderRoot } from './pathPrefix'

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

describe('isPathUnderRoot', () => {
  it('is true for a file directly under the root', () => {
    expect(isPathUnderRoot('C:\\Pics\\a.png', 'C:\\Pics')).toBe(true)
  })

  it('is true for a file nested several folders under the root', () => {
    expect(isPathUnderRoot('C:\\Pics\\sub\\deep\\a.png', 'C:\\Pics')).toBe(true)
  })

  it('is false for a path that only shares a text prefix, not a full path segment', () => {
    expect(isPathUnderRoot('C:\\Artwork\\a.png', 'C:\\Art')).toBe(false)
  })

  it('is false for a sibling folder', () => {
    expect(isPathUnderRoot('C:\\Other\\a.png', 'C:\\Pics')).toBe(false)
  })

  it('works whether or not the root already ends in a separator', () => {
    expect(isPathUnderRoot('C:\\Pics\\a.png', 'C:\\Pics\\')).toBe(true)
  })

  it.skipIf(process.platform === 'linux')('matches case-insensitively', () => {
    expect(isPathUnderRoot('c:\\pics\\a.png', 'C:\\Pics')).toBe(true)
  })
})
