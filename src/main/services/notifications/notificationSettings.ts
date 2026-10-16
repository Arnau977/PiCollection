import {
  APP_ALERT_KINDS,
  APP_NOTIFICATION_KINDS,
  type AppAlertKind,
  type AppNotificationKind
} from '@shared/models'
import { createJsonSettingsFile } from '../jsonSettingsFile'

export interface NotificationSnooze {
  until: number
  /** The item's count when snoozed; a higher count resurfaces it early. */
  count: number | null
}

export type NotificationSnoozes = Partial<Record<AppNotificationKind, NotificationSnooze>>

interface NotificationSettings {
  snoozed: NotificationSnoozes
  /** Alerts switched off in Settings > General > Notifications. */
  disabled: AppAlertKind[]
}

function parse(raw: unknown): NotificationSettings {
  const saved = (raw ?? {}) as { snoozed?: Record<string, unknown>; disabled?: unknown }
  const savedSnoozes = (saved.snoozed ?? {}) as Record<
    string,
    Partial<NotificationSnooze> | undefined
  >
  const snoozed: NotificationSnoozes = {}
  for (const kind of APP_NOTIFICATION_KINDS) {
    const entry = savedSnoozes[kind]
    if (entry && typeof entry.until === 'number') {
      snoozed[kind] = {
        until: entry.until,
        count: typeof entry.count === 'number' ? entry.count : null
      }
    }
  }
  const disabled = Array.isArray(saved.disabled)
    ? APP_ALERT_KINDS.filter((kind) => (saved.disabled as unknown[]).includes(kind))
    : []
  return { snoozed, disabled }
}

const settingsFile = createJsonSettingsFile<NotificationSettings>(
  'notifications-settings.json',
  parse,
  { snoozed: {}, disabled: [] }
)

export function readSnoozes(): NotificationSnoozes {
  return settingsFile.read().snoozed
}

export function writeSnoozes(snoozed: NotificationSnoozes): void {
  settingsFile.write({ ...settingsFile.read(), snoozed })
}

export function readDisabledAlerts(): AppAlertKind[] {
  return settingsFile.read().disabled
}

export function isAlertEnabled(kind: AppAlertKind): boolean {
  return !settingsFile.read().disabled.includes(kind)
}

export function setAlertEnabled(kind: AppAlertKind, enabled: boolean): AppAlertKind[] {
  const current = settingsFile.read()
  const others = current.disabled.filter((disabledKind) => disabledKind !== kind)
  const disabled = enabled ? others : [...others, kind]
  settingsFile.write({ ...current, disabled })
  return disabled
}

/** Test-only. */
export function resetNotificationSettingsCache(): void {
  settingsFile.invalidate()
}
