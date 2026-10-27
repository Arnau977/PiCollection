import { promises as fs } from 'fs'
import { getDb } from '../database/connection'
import * as mediaRepo from '../database/repositories/media.repository'
import { logError } from '../logging/logger'
import { readSourceFolder, resolveRoute } from './sourceFolder'

const BATCH_SIZE = 50

let running: Promise<void> | null = null
let runAgain = false

/**
 * Reads the size on disk of every media file that hasn't had it read - the
 * whole library the first time, then each new or replaced file - for sorting
 * by weight. Same shape as the automatic tags' analyzeNewFiles: batches yield
 * to the event loop, and a call during a pass asks for one more pass. A file
 * that can't be read (missing, drive unplugged) stays unknown and is tried
 * again next pass.
 */
export function readNewFileSizes(): Promise<void> {
  if (running) {
    runAgain = true
    return running
  }
  running = (async (): Promise<void> => {
    do {
      runAgain = false
      await readPass()
    } while (runAgain)
  })()
    .catch((err) => logError('fileSizes', 'Reading file sizes failed', err))
    .finally(() => {
      running = null
    })
  return running
}

async function readPass(): Promise<void> {
  const db = getDb()
  const sourceFolder = readSourceFolder()
  let afterId = ''
  for (;;) {
    const rows = await mediaRepo.listMediaWithoutFileSize(db, afterId, BATCH_SIZE)
    if (rows.length === 0) return
    for (const row of rows) {
      const stat = await fs.stat(resolveRoute(row.route, sourceFolder)).catch(() => null)
      if (stat?.isFile()) await mediaRepo.setMediaFileSize(db, row.id, stat.size)
    }
    afterId = rows[rows.length - 1].id
    await new Promise((resolve) => setImmediate(resolve))
  }
}
