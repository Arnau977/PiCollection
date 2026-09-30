import { getDb } from '../database/connection'
import * as mediaRepo from '../database/repositories/media.repository'
import { computeFileHash, computePerceptualHash } from './mediaHash'
import { readSourceFolder, resolveRoute } from './sourceFolder'

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
  // Read once: the setting can't change while this sweep is running, and a
  // route stored relative to it must be resolved before it can be hashed -
  // otherwise the empty-string sentinel below would permanently blacklist
  // every relative row.
  const sourceFolder = readSourceFolder()
  let processed = 0
  let unavailable = 0

  for (;;) {
    const rows = await mediaRepo.listMediaRowsMissingHash(db, BATCH_SIZE)
    if (rows.length === 0) break

    for (const row of rows) {
      const resolvedRoute = resolveRoute(row.route, sourceFolder)
      const hash = await computeFileHash(resolvedRoute)
      const fingerprint = hash ? await computePerceptualHash(resolvedRoute) : null
      await mediaRepo.setMediaHash(
        db,
        row.id,
        hash ?? '',
        fingerprint?.phash ?? null,
        hash ? (fingerprint?.aspectRatio ?? 0) : null
      )
      processed += 1
      if (!hash) unavailable += 1
    }

    await new Promise((resolve) => setImmediate(resolve))
  }

  // Rows already hashed but without a fingerprint (all of them right after
  // migration 0018 replaced the old hash). An undecodable file gets aspect
  // ratio 0, so it isn't retried on every start.
  for (;;) {
    const rows = await mediaRepo.listMediaRowsMissingFingerprint(db, BATCH_SIZE)
    if (rows.length === 0) break

    for (const row of rows) {
      const fingerprint = await computePerceptualHash(resolveRoute(row.route, sourceFolder))
      await mediaRepo.setMediaFingerprint(
        db,
        row.id,
        fingerprint?.phash ?? null,
        fingerprint?.aspectRatio ?? 0
      )
      processed += 1
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
