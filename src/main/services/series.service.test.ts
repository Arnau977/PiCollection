import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'
import { seriesService } from './series.service'

let cleanup: () => Promise<void>

beforeEach(async () => {
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
})

describe('seriesService', () => {
  it('includes each series direct media count, 0 when untagged', async () => {
    const series = await seriesService.createSeries({ name: 'untagged' })
    const all = await seriesService.getAllSeries()
    expect(all.find((s) => s.id === series.id)?.mediaCount).toBe(0)
  })

  it('creates and lists series', async () => {
    await seriesService.createSeries({ name: 'zebra' })
    await seriesService.createSeries({ name: 'apple' })

    const all = await seriesService.getAllSeries()

    expect(all.map((s) => s.name)).toEqual(['apple', 'zebra'])
  })

  it('defaults aliases to an empty array when omitted', async () => {
    const series = await seriesService.createSeries({ name: 'Wonderland' })
    expect(series.aliases).toEqual([])
  })

  it('stores aliases and round-trips them through JSON storage', async () => {
    const series = await seriesService.createSeries({
      name: 'Wonderland',
      aliases: ['Alice in Wonderland']
    })
    expect(series.aliases).toEqual(['Alice in Wonderland'])
  })

  it('updates a series', async () => {
    const series = await seriesService.createSeries({ name: 'old-name' })
    const updated = await seriesService.updateSeries(series.id, {
      name: 'new-name',
      aliases: ['alt']
    })
    expect(updated.name).toBe('new-name')
    expect(updated.aliases).toEqual(['alt'])
  })

  it('deletes a series', async () => {
    const series = await seriesService.createSeries({ name: 'temp' })
    await seriesService.deleteSeries(series.id)
    const all = await seriesService.getAllSeries()
    expect(all).toEqual([])
  })

  it('sets createdAt on a newly created series', async () => {
    const before = Date.now()
    const series = await seriesService.createSeries({ name: 'fresh' })
    expect(series.createdAt).toBeGreaterThanOrEqual(before)
  })

  it('defaults parentId to null when omitted', async () => {
    const series = await seriesService.createSeries({ name: 'root' })
    expect(series.parentId).toBeNull()
  })

  it('stores and returns a parentId set on create', async () => {
    const parent = await seriesService.createSeries({ name: 'parent' })
    const child = await seriesService.createSeries({ name: 'child', parentId: parent.id })
    expect(child.parentId).toBe(parent.id)
  })

  it('updates a series to attach it to a parent', async () => {
    const parent = await seriesService.createSeries({ name: 'parent' })
    const child = await seriesService.createSeries({ name: 'child' })

    const updated = await seriesService.updateSeries(child.id, {
      name: child.name,
      parentId: parent.id
    })

    expect(updated.parentId).toBe(parent.id)
  })

  it('rejects setting a series as its own parent', async () => {
    const series = await seriesService.createSeries({ name: 'self' })

    await expect(
      seriesService.updateSeries(series.id, { name: series.name, parentId: series.id })
    ).rejects.toThrow(/cycle|own parent/i)
  })

  it('rejects parenting a series to one of its own descendants', async () => {
    const grandparent = await seriesService.createSeries({ name: 'grandparent' })
    const parent = await seriesService.createSeries({ name: 'parent', parentId: grandparent.id })
    const child = await seriesService.createSeries({ name: 'child', parentId: parent.id })

    await expect(
      seriesService.updateSeries(grandparent.id, { name: grandparent.name, parentId: child.id })
    ).rejects.toThrow(/cycle|descendant/i)
  })
})
