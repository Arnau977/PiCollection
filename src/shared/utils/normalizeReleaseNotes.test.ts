import { describe, expect, it } from 'vitest'
import { normalizeReleaseNotes } from './normalizeReleaseNotes'

describe('normalizeReleaseNotes', () => {
  it('passes a plain string through unchanged', () => {
    expect(normalizeReleaseNotes('## Highlights\n\n- a')).toBe('## Highlights\n\n- a')
  })

  it('returns null for null or undefined', () => {
    expect(normalizeReleaseNotes(null)).toBeNull()
    expect(normalizeReleaseNotes(undefined)).toBeNull()
  })

  it('takes the first entry\'s note when given an array (skipped-versions case)', () => {
    expect(
      normalizeReleaseNotes([
        { version: '1.2.0', note: '## Highlights\n\n- a' },
        { version: '1.1.0', note: '## Highlights\n\n- b' }
      ])
    ).toBe('## Highlights\n\n- a')
  })

  it('returns null when the first entry has a null note', () => {
    expect(normalizeReleaseNotes([{ version: '1.2.0', note: null }])).toBeNull()
  })

  it('returns null for an empty array', () => {
    expect(normalizeReleaseNotes([])).toBeNull()
  })
})
