import {
  ALERT_DEFAULTS,
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
  /** Switches the user flipped in Settings > General > Notifications; the rest follow ALERT_DEFAULTS. */
  alerts: Partial<Record<AppAlertKind, boolean>>
  /**
   * The "new files in the source folder" alert only counts files created
   * after this - set when that alert is switched on or marked as seen - so a
   * big never-imported backlog doesn't keep it lit forever.
   */
  newFilesSince: number | null
}

function parse(raw: unknown): NotificationSettings {
  const saved = (raw ?? {}) as {
    snoozed?: Record<string, unknown>
    alerts?: Record<string, unknown>
    newFilesSince?: unknown
  }
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
  const alerts: Partial<Record<AppAlertKind, boolean>> = {}
  for (const kind of APP_ALERT_KINDS) {
    const value = saved.alerts?.[kind]
    if (typeof value === 'boolean') alerts[kind] = value
  }
  const newFilesSince = typeof saved.newFilesSince === 'number' ? saved.newFilesSince : null
  return { snoozed, alerts, newFilesSince }
}

const settingsFile = createJsonSettingsFile<NotificationSettings>(
  'notifications-settings.json',
  parse,
  { snoozed: {}, alerts: {}, newFilesSince: null }
)

export function readSnoozes(): NotificationSnoozes {
  return settingsFile.read().snoozed
}

export function writeSnoozes(snoozed: NotificationSnoozes): void {
  settingsFile.write({ ...settingsFile.read(), snoozed })
}

export function readAlertSettings(): Record<AppAlertKind, boolean> {
  return { ...ALERT_DEFAULTS, ...settingsFile.read().alerts }
}

/** Updates have no switch: they're always shown. */
export function isAlertEnabled(kind: AppNotificationKind | AppAlertKind): boolean {
  return kind === 'update-available' ? true : readAlertSettings()[kind]
}

export function setAlertEnabled(
  kind: AppAlertKind,
  enabled: boolean
): Record<AppAlertKind, boolean> {
  const current = settingsFile.read()
  const newFilesSince =
    kind === 'source-folder-new' && enabled ? Date.now() : current.newFilesSince
  settingsFile.write({ ...current, alerts: { ...current.alerts, [kind]: enabled }, newFilesSince })
  return readAlertSettings()
}

export function readNewFilesSince(): number | null {
  return settingsFile.read().newFilesSince
}

export function setNewFilesSince(since: number): void {
  settingsFile.write({ ...settingsFile.read(), newFilesSince: since })
}

/** Test-only. */
export function resetNotificationSettingsCache(): void {
  settingsFile.invalidate()
}
