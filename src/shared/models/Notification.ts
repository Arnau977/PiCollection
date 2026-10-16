export const APP_NOTIFICATION_KINDS = [
  'update-available',
  'backup-failed',
  'backup-stale',
  'pending-stale',
  'missing-files',
  'source-folder-new'
] as const

export type AppNotificationKind = (typeof APP_NOTIFICATION_KINDS)[number]

/**
 * Something still waiting for the user - a condition, not an event: it is
 * listed while the condition holds and disappears once resolved. Text is
 * built in the renderer from `kind` and these params.
 */
export interface AppNotification {
  kind: AppNotificationKind
  severity: 'info' | 'attention'
  snoozable: boolean
  /** Items behind it (pending media, missing/new files), when countable. */
  count?: number
  /** Epoch ms: oldest pending media, or last backup (null = never). */
  since?: number | null
  /** update-available only. */
  version?: string
}

/**
 * What can be switched in Settings > General > Notifications: every bell kind
 * but updates (always shown), plus the auto-import toast.
 */
export const APP_ALERT_KINDS = [
  'backup-failed',
  'backup-stale',
  'pending-stale',
  'missing-files',
  'source-folder-new',
  'auto-import'
] as const

export type AppAlertKind = (typeof APP_ALERT_KINDS)[number]

/** Until the user flips a switch: only what needs fixing or was asked for is on. */
export const ALERT_DEFAULTS: Record<AppAlertKind, boolean> = {
  'backup-failed': true,
  'backup-stale': false,
  'pending-stale': false,
  'missing-files': false,
  'source-folder-new': false,
  // Only fires once the user turns auto-import on, when they'd expect it.
  'auto-import': true
}
