import type { AppNotification, AppNotificationKind } from '@shared/models'
import { getDb, isDbOpen } from '../../database/connection'
import { getStatus as getUpdaterStatus } from '../../updater/autoUpdater'
import { getAutoBackupStatus } from '../autoBackup.service'
import { onAppStateChanged } from '../../events/appStateEvents'
import { notifyNotificationsChanged } from '../../events/notificationEvents'
import { logError } from '../../logging/logger'
import {
  backupFailedProvider,
  pendingStaleProvider,
  updateProvider,
  type ProviderResult
} from './notificationProviders'
import { readSnoozes, writeSnoozes, type NotificationSnoozes } from './notificationSettings'

const DAY_MS = 24 * 60 * 60 * 1000
export const SNOOZE_MS = 7 * DAY_MS
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000

let lastPushed = '[]'
let queue: Promise<unknown> = Promise.resolve()
let intervalTimer: NodeJS.Timeout | undefined
let unsubscribe: (() => void) | undefined

async function collect(now: number): Promise<ProviderResult[]> {
  return [
    updateProvider(getUpdaterStatus()),
    backupFailedProvider(getAutoBackupStatus()),
    await pendingStaleProvider(isDbOpen() ? getDb() : null, now)
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

export function startNotifications(): void {
  const refresh = (): void => {
    refreshNotifications().catch((err) => logError('notifications', 'Refresh failed', err))
  }
  unsubscribe = onAppStateChanged(refresh)
  intervalTimer = setInterval(refresh, REFRESH_INTERVAL_MS)
  intervalTimer.unref()
  refresh()
}

export function stopNotifications(): void {
  unsubscribe?.()
  if (intervalTimer) clearInterval(intervalTimer)
}

/** Test-only. */
export function __resetNotificationsForTests(): void {
  lastPushed = '[]'
  queue = Promise.resolve()
}
