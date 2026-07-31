import { getDb } from '../database/connection'
import * as mediaRepo from '../database/repositories/media.repository'
import { computeFileHash, computePerceptualHash } from './mediaHash'

const BATCH_SIZE = 20

/**
 * One-time-per-file sweep that fills in `hash`/`phash` for media rows added
 * before duplicate detection existed. Runs in small batches, yielding to the
 * event loop between them, so it never blocks the UI thread for long even on
 * a large library. A file that can no longer be read (moved/deleted) gets an
 * empty-string sentinel instead of null, so `listMediaRowsMissingHash` (which
 * only selects `hash IS NULL`) skips it on every future app start instead of
 * retrying it forever.
 */
export async function backfillMediaHashes(): Promise<void> {
  const db = getDb()
  let processed = 0
  let unavailable = 0

  for (;;) {
    const rows = await mediaRepo.listMediaRowsMissingHash(db, BATCH_SIZE)
    if (rows.length === 0) break

    for (const row of rows) {
      const hash = await computeFileHash(row.route)
      const phash = hash ? await computePerceptualHash(row.route) : null
      await mediaRepo.setMediaHash(db, row.id, hash ?? '', phash)
      processed += 1
      if (!hash) unavailable += 1
    }

    await new Promise((resolve) => setImmediate(resolve))
  }

  if (processed > 0) {
    console.info(
      `[mediaHashBackfill] hashed ${processed} media row(s)` +
        (unavailable ? ` (${unavailable} file(s) could not be read)` : '')
    )
  }
}
