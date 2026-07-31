import { promises as fs } from 'fs'
import { getDb } from '../database/connection'
import * as mediaRepo from '../database/repositories/media.repository'
import { findCommonPathPrefix, withTrailingSeparator } from './pathPrefix'
import type { MediaModel, MissingFileItem, MissingFilesCheck, RelinkOneResult, RelinkResult } from '@shared/models'

// Windows and macOS treat paths case-insensitively; Linux does not. The
// comparison has to follow the host filesystem, but the stored casing is
// preserved when the new route is built.
const CASE_INSENSITIVE_PATHS = process.platform !== 'linux'

// Keeps the missing-files list from rendering hundreds of rows when a whole
// drive is unplugged - the bulk folder relink is the right tool for that
// scale, this list is for the rare one-off rename.
const MAX_MISSING_ITEMS = 50

function matchesRoot(route: string, root: string): boolean {
  if (CASE_INSENSITIVE_PATHS) return route.toLowerCase().startsWith(root.toLowerCase())
  return route.startsWith(root)
}

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
    const rows = await mediaRepo.listMediaRoutesWithMeta(db)
    const existsFlags = await Promise.all(rows.map((row) => fileExists(row.route)))
    const missingRows = rows.filter((_, index) => !existsFlags[index])

    const missingItems: MissingFileItem[] = missingRows.slice(0, MAX_MISSING_ITEMS).map((row) => ({
      id: row.id,
      name: row.name,
      route: row.route,
      type: row.type as MediaModel['type']
    }))

    return {
      totalCount: rows.length,
      missingCount: missingRows.length,
      suggestedOldRoot: findCommonPathPrefix(missingRows.map((row) => row.route)),
      missingItems
    }
  },

  async relinkMissingFiles(oldRoot: string, newRoot: string): Promise<RelinkResult> {
    const db = getDb()
    // Both roots are normalized to end in a separator: the suggested old root
    // already does, the picked new root never does, and the old root is
    // user-editable so it can arrive either way.
    const normalizedOldRoot = withTrailingSeparator(oldRoot)
    const normalizedNewRoot = withTrailingSeparator(newRoot)

    const rows = await mediaRepo.listMediaRoutes(db)
    const updates = rows
      .filter((row) => matchesRoot(row.route, normalizedOldRoot))
      .map((row) => ({
        id: row.id,
        route: normalizedNewRoot + row.route.slice(normalizedOldRoot.length)
      }))

    await mediaRepo.updateMediaRoutes(db, updates)

    const afterRows = await mediaRepo.listMediaRoutes(db)
    return { updatedCount: updates.length, stillMissingCount: await countMissing(afterRows) }
  },

  async relinkOne(mediaId: string, newRoute: string): Promise<RelinkOneResult> {
    const db = getDb()
    await mediaRepo.updateMediaRoutes(db, [{ id: mediaId, route: newRoute }])
    return { updated: true }
  }
}
