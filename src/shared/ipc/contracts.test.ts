import { describe, expect, it } from 'vitest'
import {
  MediaInputSchema,
  FilterListInputSchema,
  MediaBatchUpdateAssociationsSchema,
  MediaFiltersSchema
} from './contracts'

describe('MediaInputSchema', () => {
  const media = { sfw: true, isAiGenerated: false, type: 'image', route: '/a.png' }

  it('trims the name and refuses a blank one', () => {
    expect(MediaInputSchema.parse({ ...media, name: '  a  ' }).name).toBe('a')
    expect(MediaInputSchema.safeParse({ ...media, name: '   ' }).success).toBe(false)
  })
})

describe('FilterListInputSchema', () => {
  it('drops paging, Pending and list ids from the saved filters', () => {
    const parsed = FilterListInputSchema.parse({
      name: 'Apta',
      filters: { sfw: true, limit: 5, pendingTagging: true, filterListIds: ['a'] },
      includedListIds: []
    })
    expect(parsed.filters).toEqual({ sfw: true })
  })
})

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

describe('MediaBatchUpdateAssociationsSchema', () => {
  it('accepts a payload with at least one add/remove selection, defaulting the rest to empty arrays', () => {
    const result = MediaBatchUpdateAssociationsSchema.parse({
      mediaIds: ['m1'],
      addTagIds: ['t1']
    })
    expect(result).toEqual({
      mediaIds: ['m1'],
      addTagIds: ['t1'],
      removeTagIds: [],
      addCharacterIds: [],
      removeCharacterIds: [],
      addSeriesIds: [],
      removeSeriesIds: []
    })
  })

  it('rejects a payload where every add/remove list is empty', () => {
    expect(() => MediaBatchUpdateAssociationsSchema.parse({ mediaIds: ['m1'] })).toThrow()
  })

  it('rejects a payload with no media ids', () => {
    expect(() =>
      MediaBatchUpdateAssociationsSchema.parse({ mediaIds: [], addTagIds: ['t1'] })
    ).toThrow()
  })
})
