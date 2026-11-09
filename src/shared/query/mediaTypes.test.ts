import { describe, expect, it } from 'vitest'
import { normalizeTypes, toggleType } from './mediaTypes'

describe('mediaTypes', () => {
  it('checks and unchecks types in a fixed order, nothing checked meaning every type', () => {
    expect(toggleType(undefined, 'video', true)).toEqual(['video'])
    expect(toggleType(['video'], 'image', true)).toEqual(['image', 'video'])
    expect(toggleType(['image', 'video'], 'video', false)).toEqual(['image'])
    expect(toggleType(['image'], 'image', false)).toBeUndefined()
  })

  it('stores none or all types as no filter, and reads an old single type', () => {
    expect(normalizeTypes(['video', 'gif', 'image'])).toBeUndefined()
    expect(normalizeTypes([])).toBeUndefined()
    expect(normalizeTypes('gif')).toEqual(['gif'])
    expect(normalizeTypes(['video', 'image', 'video'])).toEqual(['image', 'video'])
  })
})
