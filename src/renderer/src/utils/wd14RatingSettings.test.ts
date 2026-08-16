// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import {
  DEFAULT_WD14_NSFW_THRESHOLD,
  loadWd14NsfwThreshold,
  saveWd14NsfwThreshold,
  wd14RatingIsNsfw
} from './wd14RatingSettings'

beforeEach(() => {
  window.localStorage.clear()
})

describe('wd14NsfwThreshold persistence', () => {
  it('defaults to "questionable" when nothing is stored', () => {
    expect(loadWd14NsfwThreshold()).toBe('questionable')
    expect(DEFAULT_WD14_NSFW_THRESHOLD).toBe('questionable')
  })

  it('persists and reloads a saved threshold', () => {
    saveWd14NsfwThreshold('sensitive')
    expect(loadWd14NsfwThreshold()).toBe('sensitive')
  })

  it('falls back to the default for a corrupted or unrecognized stored value', () => {
    window.localStorage.setItem('picollection:wd14-nsfw-threshold', 'not-a-real-rating')
    expect(loadWd14NsfwThreshold()).toBe('questionable')
  })
})

describe('wd14RatingIsNsfw', () => {
  it('treats general and sensitive as SFW under the default threshold', () => {
    expect(wd14RatingIsNsfw('general', 'questionable')).toBe(false)
    expect(wd14RatingIsNsfw('sensitive', 'questionable')).toBe(false)
    expect(wd14RatingIsNsfw('questionable', 'questionable')).toBe(true)
    expect(wd14RatingIsNsfw('explicit', 'questionable')).toBe(true)
  })

  it('only flags explicit under the strictest-permitted threshold', () => {
    expect(wd14RatingIsNsfw('questionable', 'explicit')).toBe(false)
    expect(wd14RatingIsNsfw('explicit', 'explicit')).toBe(true)
  })

  it('flags everything but general under the most sensitive threshold', () => {
    expect(wd14RatingIsNsfw('general', 'sensitive')).toBe(false)
    expect(wd14RatingIsNsfw('sensitive', 'sensitive')).toBe(true)
  })
})
