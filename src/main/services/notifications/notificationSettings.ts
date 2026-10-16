import { APP_NOTIFICATION_KINDS, type AppNotificationKind } from '@shared/models'
import { createJsonSettingsFile } from '../jsonSettingsFile'

export interface NotificationSnooze {
  until: number
  /** The item's count when snoozed; a higher count resurfaces it early. */
  count: number | null
}

export type NotificationSnoozes = Partial<Record<AppNotificationKind, NotificationSnooze>>

function parse(raw: unknown): { snoozed: NotificationSnoozes } {
  const saved = ((raw as { snoozed?: Record<string, unknown> } | null)?.snoozed ?? {}) as Record<
    string,
    Partial<NotificationSnooze> | undefined
  >
  const snoozed: NotificationSnoozes = {}
  for (const kind of APP_NOTIFICATION_KINDS) {
    const entry = saved[kind]
    if (entry && typeof entry.until === 'number') {
      snoozed[kind] = {
        until: entry.until,
        count: typeof entry.count === 'number' ? entry.count : null
      }
    }
  }
  return { snoozed }
}

const settingsFile = createJsonSettingsFile('notifications-settings.json', parse, { snoozed: {} })

export function readSnoozes(): NotificationSnoozes {
  return settingsFile.read().snoozed
}

export function writeSnoozes(snoozed: NotificationSnoozes): void {
  settingsFile.write({ snoozed })
}

/** Test-only. */
export function resetNotificationSettingsCache(): void {
  settingsFile.invalidate()
}
