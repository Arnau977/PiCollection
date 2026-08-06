import { describe, expect, it } from 'vitest'
import { extractHighlights } from './extractHighlights'

describe('extractHighlights', () => {
  it('returns the trimmed content of a filled-in Highlights section', () => {
    const notes = [
      '## Highlights',
      '',
      '- Series filters now match descendant series',
      '- Fixed duplicate detection on GIFs',
      '',
      '## What\'s Changed',
      '* fix: something by @user in #123'
    ].join('\n')

    expect(extractHighlights(notes)).toBe(
      '- Series filters now match descendant series\n- Fixed duplicate detection on GIFs'
    )
  })

  it('returns null when the Highlights section still has the placeholder', () => {
    const notes = [
      '## Highlights',
      '',
      '_Fill in 2-3 bullet points of user-facing changes before publishing._',
      '',
      '## What\'s Changed',
      '* fix: something by @user in #123'
    ].join('\n')

    expect(extractHighlights(notes)).toBeNull()
  })

  it('returns null when there is no Highlights heading at all', () => {
    const notes = '## What\'s Changed\n* fix: something by @user in #123'
    expect(extractHighlights(notes)).toBeNull()
  })

  it('returns the content to the end of the string when Highlights is the last section', () => {
    const notes = '## Highlights\n\n- Only change this release'
    expect(extractHighlights(notes)).toBe('- Only change this release')
  })

  it('returns null for an empty Highlights section', () => {
    const notes = '## Highlights\n\n## What\'s Changed\n* fix: something'
    expect(extractHighlights(notes)).toBeNull()
  })

  it('returns null for null or undefined input', () => {
    expect(extractHighlights(null)).toBeNull()
    expect(extractHighlights(undefined)).toBeNull()
    expect(extractHighlights('')).toBeNull()
  })
})
