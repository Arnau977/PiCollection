import type { Kysely } from 'kysely'
import type {
  AppNotification,
  AppNotificationKind,
  AutoBackupStatus,
  UpdaterEvent
} from '@shared/models'
import type { DB } from '../../database/schema'
import * as mediaRepo from '../../database/repositories/media.repository'

const DAY_MS = 24 * 60 * 60 * 1000
export const PENDING_STALE_MS = 7 * DAY_MS

/**
 * One kind's current state: `item` when it should be listed, `null` when
 * its condition is known to be clear. A provider returns `null` instead of
 * a result when the state is unknown (a scan that hasn't run, a closed DB),
 * so a snooze isn't dropped just because nobody looked yet.
 */
export type ProviderResult = { kind: AppNotificationKind; item: AppNotification | null } | null

export function updateProvider(status: UpdaterEvent | null): ProviderResult {
  if (status?.type === 'available' || status?.type === 'downloaded') {
    return {
      kind: 'update-available',
      item: { kind: 'update-available', severity: 'info', snoozable: true, version: status.version }
    }
  }
  return { kind: 'update-available', item: null }
}

export function backupFailedProvider(status: AutoBackupStatus): ProviderResult {
  return {
    kind: 'backup-failed',
    item:
      status.enabled && status.lastError
        ? { kind: 'backup-failed', severity: 'attention', snoozable: false }
        : null
  }
}

export async function pendingStaleProvider(
  db: Kysely<DB> | null,
  now: number
): Promise<ProviderResult> {
  if (!db) return null
  const { count, oldest } = await mediaRepo.pendingSummary(db)
  const stale = count > 0 && oldest !== null && now - oldest >= PENDING_STALE_MS
  return {
    kind: 'pending-stale',
    item: stale
      ? { kind: 'pending-stale', severity: 'info', snoozable: true, count, since: oldest }
      : null
  }
}
