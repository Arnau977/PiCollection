import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'
import { tagService } from './tag.service'

let cleanup: () => Promise<void>

beforeEach(async () => {
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
})

describe('tagService', () => {
  it('creates and lists tags', async () => {
    await tagService.createTag({ name: 'zebra' })
    await tagService.createTag({ name: 'apple' })

    const all = await tagService.getAllTags()

    expect(all.map((t) => t.name)).toEqual(['apple', 'zebra'])
  })

  it('updates a tag name', async () => {
    const tag = await tagService.createTag({ name: 'old-name' })
    const updated = await tagService.updateTag(tag.id, { name: 'new-name' })
    expect(updated.name).toBe('new-name')
    const all = await tagService.getAllTags()
    expect(all.map((t) => t.name)).toEqual(['new-name'])
  })

  it('deletes a tag', async () => {
    const tag = await tagService.createTag({ name: 'temp' })
    await tagService.deleteTag(tag.id)
    const all = await tagService.getAllTags()
    expect(all).toEqual([])
  })
})
