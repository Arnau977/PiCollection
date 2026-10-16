import type { TFunction } from 'i18next'
import type { AppNotification } from '@shared/models'
import { PATH } from '@renderer/app.routes.const'

export interface NotificationRow {
  title: string
  detail: string | null
  actionLabel: string
  to: string
  state?: unknown
}

function relativeDay(epochMs: number, language: string): string {
  const days = Math.round((epochMs - Date.now()) / (24 * 60 * 60 * 1000))
  return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(days, 'day')
}

/** Text and destination for one tray item - all wording lives here, not in main. */
export function notificationRow(
  item: AppNotification,
  t: TFunction,
  language: string
): NotificationRow {
  const count = item.count ?? 0
  switch (item.kind) {
    case 'update-available':
      return {
        title: t('notifications.updateTitle', { version: item.version }),
        detail: null,
        actionLabel: t('notifications.actionView'),
        to: PATH.SETTINGS,
        state: { settingsTab: 'advanced' }
      }
    case 'backup-failed':
      return {
        title: t('notifications.backupFailedTitle'),
        detail: t('notifications.backupFailedDetail'),
        actionLabel: t('notifications.actionView'),
        to: PATH.SETTINGS,
        state: { settingsTab: 'data' }
      }
    case 'backup-stale':
      return {
        title: t('notifications.backupStaleTitle'),
        detail: item.since
          ? t('notifications.backupStaleDetail', { when: relativeDay(item.since, language) })
          : t('notifications.backupStaleNever'),
        actionLabel: t('notifications.actionBackUp'),
        to: PATH.SETTINGS,
        state: { settingsTab: 'data' }
      }
    case 'pending-stale':
      return {
        title: t('notifications.pendingTitle', { count }),
        detail: item.since
          ? t('notifications.pendingDetail', { when: relativeDay(item.since, language) })
          : null,
        actionLabel: t('notifications.actionGo'),
        to: PATH.PENDING
      }
    case 'missing-files':
      return {
        title: t('notifications.missingTitle', { count }),
        detail: t('notifications.missingDetail'),
        actionLabel: t('notifications.actionView'),
        to: PATH.SETTINGS,
        state: { settingsTab: 'data' }
      }
    case 'source-folder-new':
      return {
        title: t('notifications.newFilesTitle', { count }),
        detail: t('notifications.newFilesDetail'),
        actionLabel: t('notifications.actionImport'),
        to: PATH.ADD_MEDIA,
        state: { addMediaTab: 'folder' }
      }
  }
}
