import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'
import { tagService } from './tag.service'
import { notifyEntitiesChanged } from '../events/entityEvents'

vi.mock('../events/entityEvents', () => ({ notifyEntitiesChanged: vi.fn() }))

let cleanup: () => Promise<void>

beforeEach(async () => {
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
  vi.mocked(notifyEntitiesChanged).mockClear()
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

  it('sets createdAt on a newly created tag', async () => {
    const before = Date.now()
    const tag = await tagService.createTag({ name: 'fresh' })
    expect(tag.createdAt).toBeGreaterThanOrEqual(before)
  })

  it('includes each tag direct media count, 0 when untagged', async () => {
    const tag = await tagService.createTag({ name: 'untagged' })
    const all = await tagService.getAllTags()
    expect(all.find((t) => t.id === tag.id)?.mediaCount).toBe(0)
  })

  it('notifies entity-change listeners on create, update, and delete', async () => {
    const tag = await tagService.createTag({ name: 'temp' })
    expect(notifyEntitiesChanged).toHaveBeenCalledWith(['tag'])

    vi.mocked(notifyEntitiesChanged).mockClear()
    await tagService.updateTag(tag.id, { name: 'renamed' })
    expect(notifyEntitiesChanged).toHaveBeenCalledWith(['tag'])

    vi.mocked(notifyEntitiesChanged).mockClear()
    await tagService.deleteTag(tag.id)
    expect(notifyEntitiesChanged).toHaveBeenCalledWith(['tag'])
  })
})
