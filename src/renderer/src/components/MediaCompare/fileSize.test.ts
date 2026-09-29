import { describe, expect, it } from 'vitest'
import { formatFileSize } from './fileSize'

describe('formatFileSize', () => {
  it('uses 1024-based units, like Windows Explorer', () => {
    expect(formatFileSize(516_096, 'en')).toBe('504 KB')
    expect(formatFileSize(2.5 * 1024 * 1024, 'es')).toBe('2,5 MB')
    expect(formatFileSize(512, 'en')).toBe('512 B')
  })
})
