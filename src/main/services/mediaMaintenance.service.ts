import { promises as fs } from 'fs'
import { getDb } from '../database/connection'
import * as mediaRepo from '../database/repositories/media.repository'
import { findCommonPathPrefix } from './pathPrefix'

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function countMissing(rows: { route: string }[]): Promise<number> {
  const flags = await Promise.all(rows.map((row) => fileExists(row.route)))
  return flags.filter((exists) => !exists).length
}

export const mediaMaintenanceService = {
  async checkMissingFiles(): Promise<{
    totalCount: number
    missingCount: number
    suggestedOldRoot: string | null
  }> {
    const db = getDb()
    const rows = await mediaRepo.listMediaRoutes(db)
    const existsFlags = await Promise.all(rows.map((row) => fileExists(row.route)))
    const missingRoutes = rows.filter((_, index) => !existsFlags[index]).map((row) => row.route)

    return {
      totalCount: rows.length,
      missingCount: missingRoutes.length,
      suggestedOldRoot: findCommonPathPrefix(missingRoutes)
    }
  },

  async relinkMissingFiles(
    oldRoot: string,
    newRoot: string
  ): Promise<{ updatedCount: number; stillMissingCount: number }> {
    const db = getDb()
    const rows = await mediaRepo.listMediaRoutes(db)
    const updates = rows
      .filter((row) => row.route.startsWith(oldRoot))
      .map((row) => ({ id: row.id, route: newRoot + row.route.slice(oldRoot.length) }))

    await mediaRepo.updateMediaRoutes(db, updates)

    const afterRows = await mediaRepo.listMediaRoutes(db)
    return { updatedCount: updates.length, stillMissingCount: await countMissing(afterRows) }
  }
}
