import { describe, expect, it } from 'vitest'
import { deriveMediaName } from './deriveMediaName'

describe('deriveMediaName', () => {
  it('strips the extension from a plain filename', () => {
    expect(deriveMediaName('photo.jpg')).toBe('photo')
  })

  it('strips only the last extension', () => {
    expect(deriveMediaName('archive.tar.gz')).toBe('archive.tar')
  })

  it('strips the directory when given a full path with forward slashes', () => {
    expect(deriveMediaName('/Users/jane/pics/sunset.png')).toBe('sunset')
  })

  it('strips the directory when given a full Windows path', () => {
    expect(deriveMediaName('C:\\Users\\jane\\pics\\sunset.png')).toBe('sunset')
  })

  it('returns the filename unchanged when there is no extension', () => {
    expect(deriveMediaName('README')).toBe('README')
  })

  it('does not treat a leading dot (hidden file) as the extension separator', () => {
    expect(deriveMediaName('.gitignore')).toBe('.gitignore')
  })
})
