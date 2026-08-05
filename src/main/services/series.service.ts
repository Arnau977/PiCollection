import { randomUUID } from 'crypto'
import { getDb } from '../database/connection'
import * as seriesRepo from '../database/repositories/series.repository'
import type { SeriesInput, SeriesModel } from '@shared/models'
import type { SeriesTable } from '../database/schema'

function toModel(row: SeriesTable): SeriesModel {
  return {
    id: row.id,
    name: row.name,
    aliases: JSON.parse(row.aliases_json),
    createdAt: row.created_at
  }
}

export const seriesService = {
  async getAllSeries(): Promise<SeriesModel[]> {
    const rows = await seriesRepo.findAllSeries(getDb())
    return rows.map(toModel)
  },

  async createSeries(input: SeriesInput): Promise<SeriesModel> {
    const row = await seriesRepo.insertSeries(getDb(), {
      id: randomUUID(),
      name: input.name,
      aliases_json: JSON.stringify(input.aliases ?? []),
      created_at: Date.now()
    })
    return toModel(row)
  },

  async updateSeries(id: string, input: SeriesInput): Promise<SeriesModel> {
    const row = await seriesRepo.updateSeries(getDb(), id, {
      name: input.name,
      aliases_json: JSON.stringify(input.aliases ?? [])
    })
    return toModel(row)
  },

  async deleteSeries(id: string): Promise<void> {
    await seriesRepo.deleteSeries(getDb(), id)
  }
}
