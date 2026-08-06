import { describe, expect, it } from 'vitest'
import { MediaFiltersSchema } from './contracts'

describe('MediaFiltersSchema', () => {
  it('keeps isAiGenerated through parsing instead of stripping it as an unknown key', () => {
    expect(MediaFiltersSchema.parse({ isAiGenerated: true })).toEqual({ isAiGenerated: true })
    expect(MediaFiltersSchema.parse({ isAiGenerated: false })).toEqual({ isAiGenerated: false })
  })
})
