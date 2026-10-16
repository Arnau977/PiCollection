import { isDbOpen } from '../../database/connection'
import { mediaMaintenanceService } from '../mediaMaintenance.service'
import { countImportableInSourceFolder } from '../sourceFolderBrowser.service'
import { ensureSourceFolderWatcher } from '../sourceFolderWatcher/sourceFolderWatcher'
import { logError } from '../../logging/logger'

export interface ScanResults {
  /** null = not scanned yet (or the DB was closed): unknown, not zero. */
  missingCount: number | null
  newFilesCount: number | null
  sourceFolderScannedAt: number | null
}

const EMPTY: ScanResults = { missingCount: null, newFilesCount: null, sourceFolderScannedAt: null }

let results: ScanResults = { ...EMPTY }
let running: Promise<void> | null = null

/**
 * The disk walks behind two tray items, cached - they're too slow to run on
 * every ask. A call while one runs gets that run instead of starting another.
 */
export function runScans(which: { missing?: boolean; sourceFolder?: boolean } = {}): Promise<void> {
  if (running) return running
  const all = which.missing === undefined && which.sourceFolder === undefined
  running = (async (): Promise<void> => {
    if (!isDbOpen()) return
    try {
      if (all || which.missing) {
        results.missingCount = (await mediaMaintenanceService.checkMissingFiles()).missingCount
      }
      if (all || which.sourceFolder) {
        ensureSourceFolderWatcher()
        results.newFilesCount = await countImportableInSourceFolder()
        results.sourceFolderScannedAt = Date.now()
      }
    } catch (err) {
      logError('notifications', 'Scan failed', err)
    }
  })().finally(() => {
    running = null
  })
  return running
}

export function getScanResults(): ScanResults {
  return { ...results }
}

/** Test-only. */
export function __resetScansForTests(): void {
  results = { ...EMPTY }
  running = null
}
