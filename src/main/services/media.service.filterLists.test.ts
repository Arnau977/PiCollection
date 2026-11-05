import { vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '' }
}))
vi.mock('../events/entityEvents', () => ({ notifyEntitiesChanged: vi.fn() }))

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'
import { filterListService } from './filterList.service'
import { mediaService } from './media.service'
import { seriesService } from './series.service'
import { tagService } from './tag.service'
import type { FilterListInput, MediaFilters, MediaInput, TagModel } from '@shared/models'

let cleanup: () => Promise<void>
let lewd: TagModel

beforeEach(async () => {
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
  lewd = await tagService.createTag({ name: 'lewd' })
})

afterEach(async () => {
  await cleanup()
})

let routeCount = 0

function addMedia(name: string, overrides: Partial<MediaInput> = {}): Promise<unknown> {
  routeCount += 1
  return mediaService.addMedia({
    name,
    type: 'image',
    route: `/some/${routeCount}.png`,
    sfw: true,
    isAiGenerated: false,
    ...overrides
  })
}

const names = async (filters: MediaFilters): Promise<string[]> =>
  (await mediaService.getMediaFiltered(filters, { prop: 'name' })).items.map((m) => m.name)

const list = (
  name: string,
  filters: FilterListInput['filters'],
  includedListIds: string[] = []
): FilterListInput => ({ name, filters, includedListIds })

describe('mediaService with filter lists', () => {
  beforeEach(async () => {
    await addMedia('harmless')
    await addMedia('harmless gif', { type: 'gif' })
    await addMedia('tagged', { tagIds: [lewd.id] })
    await addMedia('nsfw', { sfw: false })
  })

  it('narrows by a list and by filters added on top', async () => {
    const apta = await filterListService.create(
      list('Apta', { sfw: true, tagGroups: [[`-${lewd.id}`]] })
    )

    expect(await names({ filterListIds: [apta.id] })).toEqual(['harmless', 'harmless gif'])
    expect(await names({ filterListIds: [apta.id], type: 'gif' })).toEqual(['harmless gif'])
  })

  it('applies a nested list', async () => {
    const apta = await filterListService.create(
      list('Apta', { sfw: true, tagGroups: [[`-${lewd.id}`]] })
    )
    const profile = await filterListService.create(list('Perfil', { type: 'image' }, [apta.id]))

    expect(await names({ filterListIds: [profile.id] })).toEqual(['harmless'])
  })

  it('counts a shared included list once when two lists apply', async () => {
    const apta = await filterListService.create(
      list('Apta', { sfw: true, tagGroups: [[`-${lewd.id}`]] })
    )
    const profile = await filterListService.create(list('Perfil', {}, [apta.id]))
    const banner = await filterListService.create(list('Banner', { type: 'image' }, [apta.id]))

    expect(await names({ filterListIds: [profile.id, banner.id] })).toEqual(['harmless'])
  })

  it('expands a saved series through its subseries', async () => {
    const parent = await seriesService.createSeries({ name: 'Honkai' })
    const child = await seriesService.createSeries({ name: 'Star Rail', parentId: parent.id })
    await addMedia('in child', { seriesIds: [child.id] })
    const saved = await filterListService.create(list('Honkai', { seriesGroups: [[parent.id]] }))

    expect(await names({ filterListIds: [saved.id] })).toEqual(['in child'])
  })

  it('returns nothing on a contradiction, for pages and ordered ids', async () => {
    const images = await filterListService.create(list('Images', { type: 'image' }))
    const filters: MediaFilters = { filterListIds: [images.id], type: 'gif' }

    expect(await mediaService.getMediaFiltered(filters)).toEqual({ items: [], total: 0 })
    expect(await mediaService.getMediaOrderedIds(filters)).toEqual([])
  })

  it('ignores a list that no longer exists', async () => {
    expect(await names({ filterListIds: ['gone'], type: 'gif' })).toEqual(['harmless gif'])
  })

  it('uses a list edit on the next query', async () => {
    const saved = await filterListService.create(list('Saved', { type: 'gif' }))
    await filterListService.update(saved.id, list('Saved', { sfw: false }))

    expect(await names({ filterListIds: [saved.id] })).toEqual(['nsfw'])
  })

  it('keeps filtering by what remains when a saved tag was deleted', async () => {
    const other = await tagService.createTag({ name: 'other' })
    const saved = await filterListService.create(
      list('Saved', { type: 'gif', tagGroups: [[other.id]] })
    )
    await tagService.deleteTag(other.id)

    expect(await names({ filterListIds: [saved.id] })).toEqual(['harmless gif'])
  })
})
