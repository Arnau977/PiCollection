import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'
import { getDb } from '../database/connection'
import * as tagRepo from '../database/repositories/tag.repository'
import * as autoTagRepo from '../database/repositories/autoTag.repository'
import { applyDanbooruDefaults } from './autoTags.service'

vi.mock('../events/entityEvents', () => ({ notifyEntitiesChanged: vi.fn() }))

let cleanup: () => Promise<void>

beforeEach(async () => {
  cleanup = (await initTestDbSingleton()).cleanup
})

afterEach(async () => {
  await cleanup()
})

describe('applyDanbooruDefaults', () => {
  it('reuses a tag by name or alias, creates the rest, and leaves set rules alone', async () => {
    const db = getDb()
    await tagRepo.insertTag(db, {
      id: 'alpha',
      name: 'See-through',
      aliases_json: JSON.stringify(['transparent_background']),
      created_at: 1
    })
    await tagRepo.insertTag(db, { id: 'mine', name: 'Huge', aliases_json: '[]', created_at: 1 })
    await autoTagRepo.setRule(db, 'absurdres', 'mine')

    await applyDanbooruDefaults()

    const rules = new Map((await autoTagRepo.listRules(db)).map((r) => [r.property, r.tag_id]))
    expect(rules.get('transparent')).toBe('alpha')
    expect(rules.get('absurdres')).toBe('mine')
    expect(rules.has('portrait')).toBe(false)
    const names = (await tagRepo.findAllTags(db)).map((tag) => tag.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'Highres',
        'Lowres',
        'Incredibly Absurdres',
        'Tall Image',
        'Wide Image'
      ])
    )
    expect(names).not.toContain('Absurdres')
  })
})
