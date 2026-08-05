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
})
