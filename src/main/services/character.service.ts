import { randomUUID } from 'crypto'
import type { Kysely } from 'kysely'
import { getDb } from '../database/connection'
import * as characterRepo from '../database/repositories/character.repository'
import * as seriesRepo from '../database/repositories/series.repository'
import { wouldCreateCycle } from '../database/repositories/entityHierarchy'
import { AppError } from '../errors'
import type { CharacterInput, CharacterModel, SeriesModel } from '@shared/models'
import type { CharacterTable, DB } from '../database/schema'

async function hydrateCharacters(
  db: Kysely<DB>,
  rows: CharacterTable[]
): Promise<CharacterModel[]> {
  if (!rows.length) return []
  const ids = rows.map((row) => row.id)
  const seriesByCharacter = await characterRepo.findSeriesForCharacterIds(db, ids)

  return rows.map((row) => {
    const series: SeriesModel[] = (seriesByCharacter.get(row.id) ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      aliases: JSON.parse(s.aliases_json),
      createdAt: s.created_at
    }))
    return {
      id: row.id,
      name: row.name,
      series,
      aliases: JSON.parse(row.aliases_json),
      createdAt: row.created_at,
      parentId: row.parent_id
    }
  })
}

async function getCharacterModelById(db: Kysely<DB>, id: string): Promise<CharacterModel | null> {
  const row = await characterRepo.findCharacterById(db, id)
  if (!row) return null
  const [hydrated] = await hydrateCharacters(db, [row])
  return hydrated
}

async function assertSeriesExist(db: Kysely<DB>, seriesIds: string[]): Promise<void> {
  if (!seriesIds.length) return
  const rows = await seriesRepo.findSeriesByIds(db, seriesIds)
  if (rows.length !== seriesIds.length) throw new Error('One or more series do not exist')
}

export const characterService = {
  async getAllCharacters(): Promise<CharacterModel[]> {
    const db = getDb()
    const rows = await characterRepo.findAllCharacters(db)
    const [characters, counts] = await Promise.all([
      hydrateCharacters(db, rows),
      characterRepo.countMediaPerCharacter(db)
    ])
    return characters.map((character) => ({ ...character, mediaCount: counts[character.id] ?? 0 }))
  },

  async getCharacterById(id: string): Promise<CharacterModel | null> {
    return getCharacterModelById(getDb(), id)
  },

  async createCharacter(input: CharacterInput): Promise<CharacterModel> {
    const db = getDb()
    await assertSeriesExist(db, input.seriesIds ?? [])

    const id = randomUUID()
    await db.transaction().execute(async (trx) => {
      await characterRepo.insertCharacter(trx, {
        id,
        name: input.name,
        aliases_json: JSON.stringify(input.aliases ?? []),
        created_at: Date.now(),
        parent_id: input.parentId ?? null
      })
      if (input.seriesIds?.length) {
        await characterRepo.setCharacterSeries(trx, id, input.seriesIds)
      }
    })

    const created = await getCharacterModelById(db, id)
    if (!created) throw new Error('Failed to load created character')
    return created
  },

  async updateCharacter(id: string, input: CharacterInput): Promise<CharacterModel> {
    const db = getDb()
    await assertSeriesExist(db, input.seriesIds ?? [])
    if (input.parentId) {
      const hierarchy = await characterRepo.findCharacterHierarchy(db)
      if (wouldCreateCycle(hierarchy, id, input.parentId)) {
        throw new AppError('INVALID_PARENT', 'That character cannot be its own ancestor (cycle).')
      }
    }

    await db.transaction().execute(async (trx) => {
      await characterRepo.updateCharacter(trx, id, {
        name: input.name,
        aliases_json: JSON.stringify(input.aliases ?? []),
        parent_id: input.parentId ?? null
      })
      await characterRepo.setCharacterSeries(trx, id, input.seriesIds ?? [])
    })

    const updated = await getCharacterModelById(db, id)
    if (!updated) throw new Error('Failed to load updated character')
    return updated
  },

  async deleteCharacter(id: string): Promise<void> {
    await characterRepo.deleteCharacter(getDb(), id)
  }
}
