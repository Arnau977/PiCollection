import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'
import { characterService } from './character.service'
import { seriesService } from './series.service'
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

describe('characterService', () => {
  it('notifies entity-change listeners on create, update, and delete', async () => {
    const character = await characterService.createCharacter({ name: 'temp' })
    expect(notifyEntitiesChanged).toHaveBeenCalledWith(['character'])

    vi.mocked(notifyEntitiesChanged).mockClear()
    await characterService.updateCharacter(character.id, { name: 'renamed' })
    expect(notifyEntitiesChanged).toHaveBeenCalledWith(['character'])

    vi.mocked(notifyEntitiesChanged).mockClear()
    await characterService.deleteCharacter(character.id)
    expect(notifyEntitiesChanged).toHaveBeenCalledWith(['character'])
  })

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

  it('sets createdAt on a newly created character', async () => {
    const before = Date.now()
    const character = await characterService.createCharacter({ name: 'Hero' })
    expect(character.createdAt).toBeGreaterThanOrEqual(before)
  })

  it('includes each character direct media count, 0 when untagged', async () => {
    const character = await characterService.createCharacter({ name: 'untagged' })
    const all = await characterService.getAllCharacters()
    expect(all.find((c) => c.id === character.id)?.mediaCount).toBe(0)
  })

  it('defaults parentId to null when omitted', async () => {
    const character = await characterService.createCharacter({ name: 'Alice' })
    expect(character.parentId).toBeNull()
  })

  it('stores and returns a parentId set on create', async () => {
    const parent = await characterService.createCharacter({ name: 'Elizabeth Bathory' })
    const child = await characterService.createCharacter({
      name: 'Elizabeth Bathory (Brave)',
      parentId: parent.id
    })
    expect(child.parentId).toBe(parent.id)
  })

  it('updates a character to attach it to a parent', async () => {
    const parent = await characterService.createCharacter({ name: 'parent' })
    const child = await characterService.createCharacter({ name: 'child' })

    const updated = await characterService.updateCharacter(child.id, {
      name: child.name,
      parentId: parent.id
    })

    expect(updated.parentId).toBe(parent.id)
  })

  it('rejects setting a character as its own parent', async () => {
    const character = await characterService.createCharacter({ name: 'self' })

    await expect(
      characterService.updateCharacter(character.id, { name: character.name, parentId: character.id })
    ).rejects.toThrow(/cycle|own parent/i)
  })

  it('rejects parenting a character to one of its own descendants', async () => {
    const grandparent = await characterService.createCharacter({ name: 'grandparent' })
    const parent = await characterService.createCharacter({
      name: 'parent',
      parentId: grandparent.id
    })
    const child = await characterService.createCharacter({ name: 'child', parentId: parent.id })

    await expect(
      characterService.updateCharacter(grandparent.id, {
        name: grandparent.name,
        parentId: child.id
      })
    ).rejects.toThrow(/cycle|descendant/i)
  })
})
