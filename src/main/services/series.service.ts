import { randomUUID } from 'crypto'
import { getDb } from '../database/connection'
import * as seriesRepo from '../database/repositories/series.repository'
import { wouldCreateCycle } from '../database/repositories/entityHierarchy'
import { AppError } from '../errors'
import { notifyEntitiesChanged } from '../events/entityEvents'
import type { SeriesInput, SeriesModel } from '@shared/models'
import type { SeriesTable } from '../database/schema'

function toModel(row: SeriesTable, mediaCount?: number): SeriesModel {
  return {
    id: row.id,
    name: row.name,
    aliases: JSON.parse(row.aliases_json),
    createdAt: row.created_at,
    parentId: row.parent_id,
    mediaCount
  }
}

export const seriesService = {
  async getAllSeries(): Promise<SeriesModel[]> {
    const db = getDb()
    const [rows, counts] = await Promise.all([
      seriesRepo.findAllSeries(db),
      seriesRepo.countMediaPerSeries(db)
    ])
    return rows.map((row) => toModel(row, counts[row.id] ?? 0))
  },

  async createSeries(input: SeriesInput): Promise<SeriesModel> {
    const row = await seriesRepo.insertSeries(getDb(), {
      id: randomUUID(),
      name: input.name,
      aliases_json: JSON.stringify(input.aliases ?? []),
      created_at: Date.now(),
      parent_id: input.parentId ?? null
    })
    notifyEntitiesChanged(['series'])
    return toModel(row)
  },

  async updateSeries(id: string, input: SeriesInput): Promise<SeriesModel> {
    if (input.parentId) {
      const hierarchy = await seriesRepo.findSeriesHierarchy(getDb())
      if (wouldCreateCycle(hierarchy, id, input.parentId)) {
        throw new AppError('INVALID_PARENT', 'That series cannot be its own ancestor (cycle).')
      }
    }
    const row = await seriesRepo.updateSeries(getDb(), id, {
      name: input.name,
      aliases_json: JSON.stringify(input.aliases ?? []),
      parent_id: input.parentId ?? null
    })
    notifyEntitiesChanged(['series'])
    return toModel(row)
  },

  async deleteSeries(id: string): Promise<void> {
    await seriesRepo.deleteSeries(getDb(), id)
    notifyEntitiesChanged(['series'])
  }
}
