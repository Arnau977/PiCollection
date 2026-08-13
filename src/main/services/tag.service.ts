import { randomUUID } from 'crypto'
import { getDb } from '../database/connection'
import * as tagRepo from '../database/repositories/tag.repository'
import { notifyEntitiesChanged } from '../events/entityEvents'
import type { TagInput, TagModel } from '@shared/models'
import type { TagTable } from '../database/schema'

function toModel(row: TagTable, mediaCount?: number): TagModel {
  return { id: row.id, name: row.name, createdAt: row.created_at, mediaCount }
}

export const tagService = {
  async getAllTags(): Promise<TagModel[]> {
    const db = getDb()
    const [rows, counts] = await Promise.all([
      tagRepo.findAllTags(db),
      tagRepo.countMediaPerTag(db)
    ])
    return rows.map((row) => toModel(row, counts[row.id] ?? 0))
  },

  async createTag(input: TagInput): Promise<TagModel> {
    const row = await tagRepo.insertTag(getDb(), {
      id: randomUUID(),
      name: input.name,
      created_at: Date.now()
    })
    notifyEntitiesChanged(['tag'])
    return toModel(row)
  },

  async updateTag(id: string, input: TagInput): Promise<TagModel> {
    const row = await tagRepo.updateTag(getDb(), id, { name: input.name })
    notifyEntitiesChanged(['tag'])
    return toModel(row)
  },

  async deleteTag(id: string): Promise<void> {
    await tagRepo.deleteTag(getDb(), id)
    notifyEntitiesChanged(['tag'])
  }
}
