import { promises as fs } from 'fs'
import { getDb } from '../database/connection'
import * as mediaRepo from '../database/repositories/media.repository'
import { findCommonPathPrefix, isPathUnderRoot, withTrailingSeparator } from './pathPrefix'
import { readSourceFolder, relativizeRoute, resolveRoute } from './sourceFolder'
import type {
  MediaModel,
  MissingFileItem,
  MissingFilesCheck,
  RelinkOneResult,
  RelinkResult
} from '@shared/models'

// Keeps the missing-files list from rendering hundreds of rows when a whole
// drive is unplugged - the bulk folder relink is the right tool for that
// scale, this list is for the rare one-off rename.
const MAX_MISSING_ITEMS = 50

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
  async checkMissingFiles(): Promise<MissingFilesCheck> {
    const db = getDb()
    const sourceFolder = readSourceFolder()
    const rows = await mediaRepo.listMediaRoutesWithMeta(db)
    const resolvedRows = rows.map((row) => ({ ...row, resolved: resolveRoute(row.route, sourceFolder) }))
    const existsFlags = await Promise.all(resolvedRows.map((row) => fileExists(row.resolved)))
    const missingRows = resolvedRows.filter((_, index) => !existsFlags[index])

    const missingItems: MissingFileItem[] = missingRows.slice(0, MAX_MISSING_ITEMS).map((row) => ({
      id: row.id,
      name: row.name,
      route: row.resolved,
      type: row.type as MediaModel['type']
    }))

    return {
      totalCount: rows.length,
      missingCount: missingRows.length,
      suggestedOldRoot: findCommonPathPrefix(missingRows.map((row) => row.resolved)),
      missingItems
    }
  },

  async relinkMissingFiles(oldRoot: string, newRoot: string): Promise<RelinkResult> {
    const db = getDb()
    const sourceFolder = readSourceFolder()
    // Both roots are normalized to end in a separator: the suggested old root
    // already does, the picked new root never does, and the old root is
    // user-editable so it can arrive either way.
    const normalizedOldRoot = withTrailingSeparator(oldRoot)
    const normalizedNewRoot = withTrailingSeparator(newRoot)

    const rows = await mediaRepo.listMediaRoutes(db)
    const updates = rows
      .map((row) => ({ id: row.id, resolved: resolveRoute(row.route, sourceFolder) }))
      .filter((row) => isPathUnderRoot(row.resolved, normalizedOldRoot))
      .map((row) => {
        const newAbsolute = normalizedNewRoot + row.resolved.slice(normalizedOldRoot.length)
        return { id: row.id, route: relativizeRoute(newAbsolute, sourceFolder) }
      })

    await mediaRepo.updateMediaRoutes(db, updates)

    const afterRows = await mediaRepo.listMediaRoutes(db)
    const afterResolved = afterRows.map((row) => ({ route: resolveRoute(row.route, sourceFolder) }))
    return { updatedCount: updates.length, stillMissingCount: await countMissing(afterResolved) }
  },

  async relinkOne(mediaId: string, newRoute: string): Promise<RelinkOneResult> {
    const db = getDb()
    const sourceFolder = readSourceFolder()
    await mediaRepo.updateMediaRoutes(db, [
      { id: mediaId, route: relativizeRoute(newRoute, sourceFolder) }
    ])
    return { updated: true }
  }
}
