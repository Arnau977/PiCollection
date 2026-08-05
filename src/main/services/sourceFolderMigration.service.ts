import { isAbsolute } from 'path'
import { promises as fs } from 'fs'
import { getDb } from '../database/connection'
import * as mediaRepo from '../database/repositories/media.repository'
import { readSourceFolder, relativizeRoute, resolveRoute, writeSourceFolder } from './sourceFolder'
import { logInfo } from '../logging/logger'
import type {
  SourceFolderApplyResult,
  SourceFolderMigrationItem,
  SourceFolderMigrationPlan
} from '@shared/models'

const MAX_WARN_ITEMS = 50

interface ComputedPlan {
  updates: { id: string; route: string }[]
  relocatedCount: number
  warnItems: SourceFolderMigrationItem[]
  warnedCount: number
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Shared by scan() and apply(): resolves every row against whichever source
 * folder is *currently* active (readSourceFolder(), i.e. the "old" one),
 * then decides against newPath. A row already stored relative to a folder
 * that's about to change must never be judged as a bare string against the
 * new folder - it has to go through its real absolute path first.
 */
async function computePlan(newPath: string | null): Promise<ComputedPlan> {
  const db = getDb()
  const oldPath = readSourceFolder()
  const rows = await mediaRepo.listMediaRoutesWithMeta(db)

  const updates: { id: string; route: string }[] = []
  const warnItems: SourceFolderMigrationItem[] = []
  let relocatedCount = 0
  let warnedCount = 0

  for (const row of rows) {
    const wasRelative = !isAbsolute(row.route)
    let absoluteRoute = resolveRoute(row.route, oldPath)

    // A relative row whose old-anchored file is gone, but the same relative
    // path exists under the NEW folder, almost certainly means the whole
    // source folder was moved/renamed on disk (not this one file) - the
    // naive resolve-against-old-then-test-against-new logic below would
    // otherwise pin it to a location that no longer exists. Re-anchor to
    // the new folder instead, so the relative route survives the move
    // unchanged, matching the "just change the setting" promise.
    if (wasRelative && newPath && !(await fileExists(absoluteRoute))) {
      const reAnchored = resolveRoute(row.route, newPath)
      if (await fileExists(reAnchored)) {
        absoluteRoute = reAnchored
      }
    }

    const plannedRoute = relativizeRoute(absoluteRoute, newPath)
    const staysOrBecomesRelative = plannedRoute !== absoluteRoute

    if (plannedRoute !== row.route) {
      updates.push({ id: row.id, route: plannedRoute })
    }

    if (staysOrBecomesRelative) {
      relocatedCount += 1
    } else {
      warnedCount += 1
      if (warnItems.length < MAX_WARN_ITEMS) {
        warnItems.push({ id: row.id, name: row.name, route: row.route, plannedRoute, wasRelative })
      }
    }
  }

  return { updates, relocatedCount, warnItems, warnedCount }
}

export const sourceFolderMigrationService = {
  async scan(newPath: string | null): Promise<SourceFolderMigrationPlan> {
    const { relocatedCount, warnItems, warnedCount } = await computePlan(newPath)
    return { relocatedCount, warnItems, warnedCount }
  },

  async apply(newPath: string | null): Promise<SourceFolderApplyResult> {
    const db = getDb()
    const { updates, relocatedCount, warnedCount } = await computePlan(newPath)

    // updateMediaRoutes wraps its own transaction and is awaited in full
    // before writeSourceFolder runs, so the setting only ever points at a
    // folder whose migration has actually committed.
    await mediaRepo.updateMediaRoutes(db, updates)
    writeSourceFolder(newPath)

    // writeSourceFolder() swallows filesystem errors internally, so a failed
    // write is otherwise indistinguishable from a successful one. Re-read
    // and compare against what we intended to persist - if it didn't take,
    // the DB rows above have already been migrated against newPath while the
    // setting still points at the old folder, so the caller must be told
    // this is a half-applied migration rather than a success.
    const persisted = readSourceFolder()
    const expected = newPath?.trim() || null
    if (persisted !== expected) {
      throw new Error('Failed to persist the new source folder setting after migrating routes.')
    }

    logInfo('settings', 'Source folder changed', { relocatedCount, warnedCount })

    return { relocatedCount, warnedCount }
  }
}
