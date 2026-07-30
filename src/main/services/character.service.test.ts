import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'
import { characterService } from './character.service'
import { seriesService } from './series.service'

let cleanup: () => Promise<void>

beforeEach(async () => {
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
})

describe('characterService', () => {
  it('creates a character with aliases and no series', async () => {
    const character = await characterService.createCharacter({ name: 'Nobody', aliases: ['N'] })

    expect(character.series).toEqual([])
    expect(character.aliases).toEqual(['N'])
  })

  it('defaults aliases to an empty array when omitted', async () => {
    const character = await characterService.createCharacter({ name: 'Nobody' })
    expect(character.aliases).toEqual([])
  })

  it('links a character to one or more series and hydrates them on read', async () => {
    const seriesA = await seriesService.createSeries({ name: 'Series A' })
    const seriesB = await seriesService.createSeries({ name: 'Series B' })

    const character = await characterService.createCharacter({
      name: 'Hero',
      seriesIds: [seriesA.id, seriesB.id]
    })

    expect(character.series.map((s) => s.id).sort()).toEqual([seriesA.id, seriesB.id].sort())

    const fetched = await characterService.getCharacterById(character.id)
    expect(fetched?.series.map((s) => s.id).sort()).toEqual([seriesA.id, seriesB.id].sort())
  })

  it('rejects a character referencing a series id that does not exist', async () => {
    await expect(
      characterService.createCharacter({ name: 'Hero', seriesIds: ['nonexistent-id'] })
    ).rejects.toThrow()
  })

  it('a series can be linked to multiple characters', async () => {
    const series = await seriesService.createSeries({ name: 'Shared Series' })
    const heroA = await characterService.createCharacter({ name: 'Hero A', seriesIds: [series.id] })
    const heroB = await characterService.createCharacter({ name: 'Hero B', seriesIds: [series.id] })

    expect(heroA.series.map((s) => s.id)).toEqual([series.id])
    expect(heroB.series.map((s) => s.id)).toEqual([series.id])
  })

  it('updates a character, replacing its series links', async () => {
    const seriesA = await seriesService.createSeries({ name: 'Series A' })
    const seriesB = await seriesService.createSeries({ name: 'Series B' })
    const character = await characterService.createCharacter({
      name: 'Hero',
      seriesIds: [seriesA.id]
    })

    const updated = await characterService.updateCharacter(character.id, {
      name: 'Hero Renamed',
      seriesIds: [seriesB.id]
    })

    expect(updated.name).toBe('Hero Renamed')
    expect(updated.series.map((s) => s.id)).toEqual([seriesB.id])
  })

  it('deletes a character', async () => {
    const character = await characterService.createCharacter({ name: 'Hero' })
    await characterService.deleteCharacter(character.id)
    const all = await characterService.getAllCharacters()
    expect(all).toEqual([])
  })
})
