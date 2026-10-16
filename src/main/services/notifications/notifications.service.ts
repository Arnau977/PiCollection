import type { AppNotification, AppNotificationKind } from '@shared/models'
import { getDb, isDbOpen } from '../../database/connection'
import { getStatus as getUpdaterStatus } from '../../updater/autoUpdater'
import { getAutoBackupStatus } from '../autoBackup.service'
import { readAutoBackupSettings } from '../autoBackupSettings'
import * as mediaRepo from '../../database/repositories/media.repository'
import { onAppStateChanged } from '../../events/appStateEvents'
import { notifyNotificationsChanged } from '../../events/notificationEvents'
import { logError } from '../../logging/logger'
import {
  backupFailedProvider,
  backupStaleProvider,
  missingFilesProvider,
  pendingStaleProvider,
  sourceFolderNewProvider,
  updateProvider,
  type ProviderResult
} from './notificationProviders'
import { readSnoozes, writeSnoozes, type NotificationSnoozes } from './notificationSettings'
import { getScanResults, runScans } from './notificationScans'

const DAY_MS = 24 * 60 * 60 * 1000
export const SNOOZE_MS = 7 * DAY_MS
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000
const SCAN_STARTUP_DELAY_MS = 2 * 60 * 1000
const MEDIA_SCAN_DEBOUNCE_MS = 30 * 1000
const SOURCE_FOLDER_STALE_MS = 10 * 60 * 1000

let lastPushed = '[]'
let queue: Promise<unknown> = Promise.resolve()
let intervalTimer: NodeJS.Timeout | undefined
let scanStartupTimer: NodeJS.Timeout | undefined
let mediaScanTimer: NodeJS.Timeout | undefined
let unsubscribe: (() => void) | undefined

async function collect(now: number): Promise<ProviderResult[]> {
  const scans = getScanResults()
  const db = isDbOpen() ? getDb() : null
  return [
    updateProvider(getUpdaterStatus()),
    backupFailedProvider(getAutoBackupStatus()),
    backupStaleProvider(
      readAutoBackupSettings(),
      db ? await mediaRepo.countLibraryMedia(db) : null,
      now
    ),
    await pendingStaleProvider(db, now),
    missingFilesProvider(scans.missingCount),
    sourceFolderNewProvider(scans.newFilesCount)
  ]
}

function listed(results: ProviderResult[]): AppNotification[] {
  return results.flatMap((result) => (result?.item ? [result.item] : []))
}

/**
 * Drops snoozes that expired or whose condition is known to be clear (so a
 * new occurrence shows right away), and hides items still snoozed - unless
 * their count grew since. Unknown kinds keep their snooze untouched.
 */
function applySnoozes(results: ProviderResult[], now: number): AppNotification[] {
  const snoozes = readSnoozes()
  const next: NotificationSnoozes = { ...snoozes }
  for (const kind of Object.keys(snoozes) as AppNotificationKind[]) {
    const known = results.find((result) => result?.kind === kind)
    if (now >= next[kind]!.until || (known && !known.item)) delete next[kind]
  }
  if (Object.keys(next).length !== Object.keys(snoozes).length) writeSnoozes(next)

  return listed(results).filter((item) => {
    const snooze = next[item.kind]
    if (!snooze || !item.snoozable) return true
    return (item.count ?? 0) > (snooze.count ?? 0)
  })
}

async function recompute(now: number): Promise<AppNotification[]> {
  const items = applySnoozes(await collect(now), now)
  const serialized = JSON.stringify(items)
  if (serialized !== lastPushed) {
    lastPushed = serialized
    notifyNotificationsChanged(items)
  }
  return items
}

/** Runs one at a time, so overlapping triggers can't push out of order. */
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

export function refreshNotifications(now: number = Date.now()): Promise<AppNotification[]> {
  return serialized(() => recompute(now))
}

export function snoozeNotification(
  kind: AppNotificationKind,
  now: number = Date.now()
): Promise<AppNotification[]> {
  return serialized(async () => {
    const item = listed(await collect(now)).find((candidate) => candidate.kind === kind)
    if (item?.snoozable) {
      writeSnoozes({
        ...readSnoozes(),
        [kind]: { until: now + SNOOZE_MS, count: item.count ?? null }
      })
    }
    return recompute(now)
  })
}

function refresh(): void {
  refreshNotifications().catch((err) => logError('notifications', 'Refresh failed', err))
}

function scanThenRefresh(which?: Parameters<typeof runScans>[0]): void {
  runScans(which).then(refresh)
}

/**
 * The cheap checks run on every change and every 6 h; the disk scans run 2
 * min after startup, every 6 h, and when something they depend on changed
 * (media added/removed - debounced, since a batch import saves many in a
 * row - a relink, a new source folder).
 */
export function startNotifications(): void {
  unsubscribe = onAppStateChanged((change) => {
    if (change === 'missing-files') return scanThenRefresh({ missing: true })
    if (change === 'source-folder') return scanThenRefresh()
    refresh()
    if (change === 'media') {
      if (mediaScanTimer) clearTimeout(mediaScanTimer)
      mediaScanTimer = setTimeout(
        () => scanThenRefresh({ sourceFolder: true }),
        MEDIA_SCAN_DEBOUNCE_MS
      )
      mediaScanTimer.unref()
    }
  })
  intervalTimer = setInterval(() => scanThenRefresh(), REFRESH_INTERVAL_MS)
  intervalTimer.unref()
  scanStartupTimer = setTimeout(() => scanThenRefresh(), SCAN_STARTUP_DELAY_MS)
  scanStartupTimer.unref()
  refresh()
}

/**
 * For the renderer's asks (mount, window focus): rescans the source folder
 * in the background when its count is older than 10 min, so files dropped
 * into it while the app sat in the tray show up without waiting 6 h.
 */
export function refreshSourceFolderScanIfStale(now: number = Date.now()): void {
  const scannedAt = getScanResults().sourceFolderScannedAt
  if (scannedAt !== null && now - scannedAt > SOURCE_FOLDER_STALE_MS) {
    scanThenRefresh({ sourceFolder: true })
  }
}

export function stopNotifications(): void {
  unsubscribe?.()
  if (intervalTimer) clearInterval(intervalTimer)
  if (scanStartupTimer) clearTimeout(scanStartupTimer)
  if (mediaScanTimer) clearTimeout(mediaScanTimer)
}

/** Test-only. */
export function __resetNotificationsForTests(): void {
  lastPushed = '[]'
  queue = Promise.resolve()
}
