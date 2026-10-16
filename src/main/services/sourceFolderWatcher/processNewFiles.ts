import { promises as fs } from 'fs'
import { basename, extname } from 'path'
import { getDb } from '../../database/connection'
import * as mediaRepo from '../../database/repositories/media.repository'
import * as discardedRepo from '../../database/repositories/discardedMedia.repository'
import { computeFileHash } from '../mediaHash'
import { mediaMaintenanceService } from '../mediaMaintenance.service'
import { mediaService } from '../media.service'
import { isPathUnderRoot } from '../pathPrefix'
import { readSourceFolder, relativizeRoute, resolveRoute } from '../sourceFolder'
import { typeForExtension } from '../sourceFolderBrowser.service'
import { readWatcherSettings } from './watcherSettings'
import { logError } from '../../logging/logger'

export interface ProcessResult {
  /** Library media whose file was moved or renamed and now points at it. */
  relinked: number
  /** New files added to Pending. */
  imported: number
  /** New files left alone: auto-import is off, or they predate turning it on. */
  unimported: number
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/** Creation time; some platforms report 0 for birthtime, where ctime stands in. */
function createdAt(stat: { birthtimeMs: number; ctimeMs: number }): number {
  return stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.ctimeMs
}

/**
 * Decides, one file at a time, what a file that appeared under the source
 * folder is: a library media that moved (relink it), a copy of one (skip), a
 * discarded file (skip), or new (import to Pending when auto-import is on and
 * it arrived after it was turned on). Sequential on purpose: a batch is one
 * pass of writes, never a burst.
 */
export async function processNewFiles(absPaths: string[]): Promise<ProcessResult> {
  const result: ProcessResult = { relinked: 0, imported: 0, unimported: 0 }
  const sourceFolder = readSourceFolder()
  if (!sourceFolder) return result
  const db = getDb()
  const settings = readWatcherSettings()

  for (const path of absPaths) {
    try {
      const type = typeForExtension(path)
      if (!type || !isPathUnderRoot(path, sourceFolder)) continue
      const stat = await fs.stat(path).catch(() => null)
      if (!stat?.isFile()) continue
      const hash = await computeFileHash(path)
      if (!hash) continue

      const sameContent = await mediaRepo.findMediaRowsByHash(db, hash)
      let moved: (typeof sameContent)[number] | undefined
      for (const row of sameContent) {
        if (!(await exists(resolveRoute(row.route, sourceFolder)))) {
          moved = row
          break
        }
      }
      if (moved) {
        await mediaMaintenanceService.relinkOne(moved.id, path)
        result.relinked++
        continue
      }
      if (sameContent.length > 0) continue

      const route = relativizeRoute(path, sourceFolder)
      if (await discardedRepo.isDiscarded(db, { route, hash })) continue
      if ((await mediaRepo.routesExist(db, [route])).size > 0) continue

      const eligible =
        settings.autoImport &&
        settings.autoImportEnabledAt !== null &&
        createdAt(stat) >= settings.autoImportEnabledAt
      if (!eligible) {
        result.unimported++
        continue
      }
      await mediaService.addMedia({
        name: basename(path, extname(path)),
        type,
        route: path,
        sfw: true,
        isAiGenerated: false,
        pendingTagging: true
      })
      result.imported++
    } catch (err) {
      // One unreadable or racing file shouldn't stop the rest of the batch.
      logError('watcher', `Could not process ${path}`, err)
    }
  }
  return result
}
