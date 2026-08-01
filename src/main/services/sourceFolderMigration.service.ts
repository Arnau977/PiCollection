import { isAbsolute } from 'path'
import { getDb } from '../database/connection'
import * as mediaRepo from '../database/repositories/media.repository'
import { readSourceFolder, relativizeRoute, resolveRoute, writeSourceFolder } from './sourceFolder'
import type { SourceFolderApplyResult, SourceFolderMigrationItem, SourceFolderMigrationPlan } from '@shared/models'

const MAX_WARN_ITEMS = 50

interface ComputedPlan {
  updates: { id: string; route: string }[]
  relocatedCount: number
  warnItems: SourceFolderMigrationItem[]
  warnedCount: number
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
    const absoluteRoute = resolveRoute(row.route, oldPath)
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

    return { relocatedCount, warnedCount }
  }
}
