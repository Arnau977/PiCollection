import { describe, expect, it } from 'vitest'
import { MediaFiltersSchema } from './contracts'

describe('MediaFiltersSchema', () => {
  it('keeps isAiGenerated through parsing instead of stripping it as an unknown key', () => {
    expect(MediaFiltersSchema.parse({ isAiGenerated: true })).toEqual({ isAiGenerated: true })
    expect(MediaFiltersSchema.parse({ isAiGenerated: false })).toEqual({ isAiGenerated: false })
  })

  it('keeps noCharacter and noSeries through parsing instead of stripping them as unknown keys', () => {
    expect(MediaFiltersSchema.parse({ noCharacter: true, noSeries: true })).toEqual({
      noCharacter: true,
      noSeries: true
    })
  })

  it('keeps pendingTagging through parsing instead of stripping it as an unknown key', () => {
    expect(MediaFiltersSchema.parse({ pendingTagging: true })).toEqual({ pendingTagging: true })
  })
})
