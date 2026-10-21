import { describe, expect, it } from 'vitest'
import { relativeFolder } from './relativeFolder'

describe('relativeFolder', () => {
  it('returns the folder relative to the source folder, ignoring case and separators', () => {
    expect(relativeFolder('D:\\Media\\Kaguya-sama\\Hayasaka\\a.jpg', 'd:/media/')).toBe(
      'Kaguya-sama\\Hayasaka'
    )
  })

  it('returns an empty string for a file directly in the source folder', () => {
    expect(relativeFolder('D:\\Media\\a.jpg', 'D:\\Media')).toBe('')
  })

  it('keeps the full folder for a file outside the source folder (or a mere name prefix)', () => {
    expect(relativeFolder('D:\\MediaOld\\a.jpg', 'D:\\Media')).toBe('D:\\MediaOld')
  })

  it('returns an already relative route as it is', () => {
    expect(relativeFolder('Kaguya-sama/a.jpg', 'D:\\Media')).toBe('Kaguya-sama')
  })
})
