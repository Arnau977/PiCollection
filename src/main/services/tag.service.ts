import { randomUUID } from 'crypto'
import { getDb } from '../database/connection'
import { AppError } from '../errors'
import * as tagRepo from '../database/repositories/tag.repository'
import { notifyEntitiesChanged } from '../events/entityEvents'
import type { TagInput, TagModel } from '@shared/models'
import type { TagTable } from '../database/schema'
import { NO_MEDIA, type MediaCounts } from '../database/repositories/mediaCounts'

function toModel(row: TagTable, counts?: MediaCounts): TagModel {
  return {
    id: row.id,
    name: row.name,
    aliases: JSON.parse(row.aliases_json),
    createdAt: row.created_at,
    mediaCount: counts?.library,
    pendingMediaCount: counts?.pending
  }
}

/** The UNIQUE index only catches exact matches; "Foo" and "foo" are the same tag to the user. */
async function assertNameFree(name: string, ownId?: string): Promise<void> {
  const lowered = name.toLowerCase()
  const tags = await tagRepo.findAllTags(getDb())
  if (tags.some((tag) => tag.id !== ownId && tag.name.toLowerCase() === lowered)) {
    throw new AppError('DUPLICATE', 'That name is already in use.')
  }
}

export const tagService = {
  async getAllTags(): Promise<TagModel[]> {
    const db = getDb()
    const [rows, counts] = await Promise.all([
      tagRepo.findAllTags(db),
      tagRepo.countMediaPerTag(db)
    ])
    return rows.map((row) => toModel(row, counts[row.id] ?? NO_MEDIA))
  },

  async createTag(input: TagInput): Promise<TagModel> {
    await assertNameFree(input.name)
    const row = await tagRepo.insertTag(getDb(), {
      id: randomUUID(),
      name: input.name,
      aliases_json: JSON.stringify(input.aliases ?? []),
      created_at: Date.now()
    })
    notifyEntitiesChanged(['tag'])
    return toModel(row)
  },

  async updateTag(id: string, input: TagInput): Promise<TagModel> {
    await assertNameFree(input.name, id)
    const row = await tagRepo.updateTag(getDb(), id, {
      name: input.name,
      aliases_json: JSON.stringify(input.aliases ?? [])
    })
    notifyEntitiesChanged(['tag'])
    return toModel(row)
  },

  async deleteTag(id: string): Promise<void> {
    await tagRepo.deleteTag(getDb(), id)
    notifyEntitiesChanged(['tag'])
  }
}
