import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'
import { getDb } from '../database/connection'
import { filterListService } from './filterList.service'
import { tagService } from './tag.service'
import type { FilterListInput } from '@shared/models'

let cleanup: () => Promise<void>

beforeEach(async () => {
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
})

const input = (name: string, includedListIds: string[] = []): FilterListInput => ({
  name,
  filters: { sfw: true },
  includedListIds
})

describe('filterListService', () => {
  it('saves filters and includes, and returns them', async () => {
    const apta = await filterListService.create(input('Apta'))
    await filterListService.create({
      name: 'Banner',
      filters: { type: ['image'] },
      includedListIds: [apta.id]
    })

    const all = await filterListService.getAll()

    expect(all.map((list) => list.name)).toEqual(['Apta', 'Banner'])
    expect(all[1]).toMatchObject({
      filters: { type: ['image'] },
      includedListIds: [apta.id],
      hasMissingEntities: false
    })
  })

  it('reads the single type a list saved before multi-type filters holds', async () => {
    const list = await filterListService.create({
      name: 'Old',
      filters: { sfw: true },
      includedListIds: []
    })
    await getDb()
      .updateTable('filter_list')
      .set({ filters_json: JSON.stringify({ sfw: true, type: 'gif' }) })
      .where('id', '=', list.id)
      .execute()

    expect((await filterListService.getAll())[0].filters).toEqual({ sfw: true, type: ['gif'] })
  })

  it('refuses an empty name, a repeated name and a list with nothing in it', async () => {
    await filterListService.create(input('Apta'))

    await expect(filterListService.create(input('  '))).rejects.toThrow(/name/i)
    await expect(filterListService.create(input('apta'))).rejects.toThrow(/already/i)
    await expect(
      filterListService.create({ name: 'Vacia', filters: {}, includedListIds: [] })
    ).rejects.toThrow(/empty/i)
  })

  it('allows a list holding only other lists', async () => {
    const apta = await filterListService.create(input('Apta'))
    const list = await filterListService.create({
      name: 'Solo Apta',
      filters: {},
      includedListIds: [apta.id]
    })
    expect(list.includedListIds).toEqual([apta.id])
  })

  it('refuses a list including itself', async () => {
    const a = await filterListService.create(input('A'))
    await expect(filterListService.update(a.id, input('A', [a.id]))).rejects.toThrow(/itself/)
  })

  it('refuses a cycle through other lists', async () => {
    const a = await filterListService.create(input('A'))
    const b = await filterListService.create(input('B', [a.id]))
    const c = await filterListService.create(input('C', [b.id]))

    await expect(filterListService.update(a.id, input('A', [c.id]))).rejects.toThrow(/itself/)
  })

  it('refuses deleting an included list and names who uses it', async () => {
    const apta = await filterListService.create(input('Apta'))
    const banner = await filterListService.create(input('Banner', [apta.id]))

    await expect(filterListService.delete(apta.id)).rejects.toThrow(/Banner/)

    await filterListService.delete(banner.id)
    await filterListService.delete(apta.id)
    expect(await filterListService.getAll()).toEqual([])
  })

  it('flags a list whose saved tag was deleted, and leaves it out when resolving', async () => {
    const tag = await tagService.createTag({ name: 'x' })
    await filterListService.create({
      name: 'Apta',
      filters: { sfw: true, tagGroups: [[`-${tag.id}`]] },
      includedListIds: []
    })
    await tagService.deleteTag(tag.id)

    const [saved] = await filterListService.getAll()
    expect(saved.hasMissingEntities).toBe(true)

    const [resolved] = await filterListService.resolve([saved.id])
    expect(resolved.sfw).toBe(true)
    expect(resolved.tagGroups).toBeUndefined()
  })

  it('resolves a shared included list once', async () => {
    const apta = await filterListService.create(input('Apta'))
    const profile = await filterListService.create(input('Perfil', [apta.id]))
    const banner = await filterListService.create(input('Banner', [apta.id]))

    expect(await filterListService.resolve([profile.id, banner.id])).toHaveLength(3)
  })
})
