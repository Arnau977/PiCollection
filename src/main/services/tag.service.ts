import { randomUUID } from 'crypto'
import { getDb } from '../database/connection'
import * as tagRepo from '../database/repositories/tag.repository'
import type { TagInput, TagModel } from '@shared/models'
import type { TagTable } from '../database/schema'

function toModel(row: TagTable): TagModel {
  return { id: row.id, name: row.name, createdAt: row.created_at }
}

export const tagService = {
  async getAllTags(): Promise<TagModel[]> {
    const rows = await tagRepo.findAllTags(getDb())
    return rows.map(toModel)
  },

  async createTag(input: TagInput): Promise<TagModel> {
    const row = await tagRepo.insertTag(getDb(), {
      id: randomUUID(),
      name: input.name,
      created_at: Date.now()
    })
    return toModel(row)
  },

  async updateTag(id: string, input: TagInput): Promise<TagModel> {
    const row = await tagRepo.updateTag(getDb(), id, { name: input.name })
    return toModel(row)
  },

  async deleteTag(id: string): Promise<void> {
    await tagRepo.deleteTag(getDb(), id)
  }
}
