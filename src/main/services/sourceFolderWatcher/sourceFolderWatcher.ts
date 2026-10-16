import { watch, promises as fs, type FSWatcher } from 'fs'
import { join } from 'path'
import { isDbOpen } from '../../database/connection'
import { notifyAppStateChanged } from '../../events/appStateEvents'
import { notifyAutoImported } from '../../events/autoImportEvents'
import { logError } from '../../logging/logger'
import { isAlertEnabled } from '../notifications/notificationSettings'
import { readSourceFolder } from '../sourceFolder'
import { processNewFiles } from './processNewFiles'
import { createSettleQueue } from './settleQueue'

const SETTLE_MS = 2000
const BATCH_MS = 3000

let watcher: FSWatcher | null = null
let queue: ReturnType<typeof createSettleQueue> | null = null

/**
 * A renamed or moved-in folder arrives as one event for the folder itself,
 * not for each file inside it (Windows), so folders are walked here.
 */
export async function expandPaths(paths: string[]): Promise<string[]> {
  const files: string[] = []
  for (const path of paths) {
    const stat = await fs.stat(path).catch(() => null)
    if (!stat) continue
    if (stat.isFile()) {
      files.push(path)
      continue
    }
    if (!stat.isDirectory()) continue
    const entries = await fs.readdir(path, { recursive: true, withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.isFile()) files.push(join(entry.parentPath, entry.name))
    }
  }
  return files
}

async function handleBatch(paths: string[]): Promise<void> {
  if (!isDbOpen()) return
  const result = await processNewFiles(await expandPaths(paths))
  if (result.relinked > 0) notifyAppStateChanged('missing-files')
  if (result.unimported > 0) notifyAppStateChanged('source-folder-files')
  if (result.imported > 0 && isAlertEnabled('auto-import')) notifyAutoImported(result.imported)
}

/**
 * Watches the source folder and its subfolders while the app runs (window
 * or tray): follows moved/renamed library files and, when switched on,
 * imports new ones to Pending. A no-op without a source folder or while the
 * DB is closed (a restore); an error (folder deleted, drive unplugged) stops
 * it, and the next source-folder scan restarts it (ensureSourceFolderWatcher).
 */
export function startSourceFolderWatcher(): void {
  if (watcher) return
  const folder = readSourceFolder()
  if (!folder || !isDbOpen()) return
  try {
    const nextQueue = createSettleQueue({
      settleMs: SETTLE_MS,
      batchMs: BATCH_MS,
      process: (paths) =>
        handleBatch(paths).catch((err) => logError('watcher', 'Batch failed', err))
    })
    watcher = watch(folder, { recursive: true }, (_event, filename) => {
      if (filename) nextQueue.add(join(folder, filename.toString()))
    })
    queue = nextQueue
    watcher.on('error', (err) => {
      logError('watcher', 'Source folder watcher stopped', err)
      stopSourceFolderWatcher()
    })
  } catch (err) {
    logError('watcher', 'Could not watch the source folder', err)
    stopSourceFolderWatcher()
  }
}

export function stopSourceFolderWatcher(): void {
  watcher?.close()
  watcher = null
  queue?.stop()
  queue = null
}

export function restartSourceFolderWatcher(): void {
  stopSourceFolderWatcher()
  startSourceFolderWatcher()
}

/** Starts it if it isn't running - how it recovers after an error. */
export function ensureSourceFolderWatcher(): void {
  if (!watcher) startSourceFolderWatcher()
}

export function isSourceFolderWatcherRunning(): boolean {
  return watcher !== null
}

/** Test-only. */
export function __emitWatcherErrorForTests(err: Error): void {
  watcher?.emit('error', err)
}
