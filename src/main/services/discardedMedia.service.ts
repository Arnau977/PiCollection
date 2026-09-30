import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { shell } from 'electron'
import type { Kysely } from 'kysely'
import { getDb } from '../database/connection'
import * as discardedRepo from '../database/repositories/discardedMedia.repository'
import type { DB, DiscardedMediaTable } from '../database/schema'
import type {
  DiscardFileInput,
  DiscardReason,
  DiscardedMediaModel,
  MediaModel
} from '@shared/models'
import { readSourceFolder, relativizeRoute, resolveRoute } from './sourceFolder'

function toModel(row: DiscardedMediaTable): DiscardedMediaModel {
  return {
    id: row.id,
    route: row.route,
    name: row.name,
    type: row.type as MediaModel['type'],
    reason: row.reason as DiscardReason,
    discardedAt: row.discarded_at
  }
}

/**
 * Remembers a file that left the app. `route` must already be in stored form
 * (relative to the source folder when under it), like media.route - `db` can
 * be a transaction, so a delete and its record land together.
 */
export async function recordDiscarded(
  db: Kysely<DB>,
  entry: { route: string; name: string; type: string },
  reason: DiscardReason
): Promise<void> {
  await discardedRepo.upsertDiscarded(db, {
    id: randomUUID(),
    // Only these three: a whole media row may be passed in.
    route: entry.route,
    name: entry.name,
    type: entry.type,
    reason,
    discarded_at: Date.now()
  })
}

export const discardedMediaService = {
  async list(): Promise<DiscardedMediaModel[]> {
    return (await discardedRepo.listDiscarded(getDb())).map(toModel)
  },

  /** A batch-import file dropped before it was ever saved (its route is absolute). */
  async discardFile(input: DiscardFileInput): Promise<void> {
    const route = relativizeRoute(input.route, readSourceFolder())
    await recordDiscarded(getDb(), { route, name: input.name, type: input.type }, 'deleted')
  },

  /**
   * Moves each file to the Recycle Bin and forgets it, one at a time (a bulk
   * "move all" is one call, never N concurrent ones). An already-gone file is
   * just forgotten; one that can't be trashed stays listed and is counted.
   */
  async trashFiles(ids: string[]): Promise<{ trashed: number; failed: number }> {
    const db = getDb()
    const sourceFolder = readSourceFolder()
    let trashed = 0
    let failed = 0
    for (const id of ids) {
      const row = await discardedRepo.findDiscardedById(db, id)
      if (!row) continue
      const filePath = resolveRoute(row.route, sourceFolder)
      const exists = await fs.access(filePath).then(
        () => true,
        () => false
      )
      try {
        if (exists) await shell.trashItem(filePath)
      } catch {
        failed++
        continue
      }
      await discardedRepo.deleteDiscarded(db, id)
      trashed++
    }
    return { trashed, failed }
  },

  /** Forgets the entry and leaves the file where it is. */
  async keepFile(id: string): Promise<void> {
    await discardedRepo.deleteDiscarded(getDb(), id)
  }
}
