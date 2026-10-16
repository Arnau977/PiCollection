import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC, NotificationSetEnabledSchema, NotificationSnoozeSchema } from '@shared/ipc/contracts'
import {
  refreshNotifications,
  refreshSourceFolderScanIfStale,
  snoozeNotification
} from '../services/notifications/notifications.service'
import { readDisabledAlerts, setAlertEnabled } from '../services/notifications/notificationSettings'

export function registerNotificationHandlers(): void {
  ipcMain.handle(
    IPC.notifications.getAll,
    ipcHandler(IPC.notifications.getAll, z.void(), () => {
      refreshSourceFolderScanIfStale()
      return refreshNotifications()
    })
  )

  ipcMain.handle(
    IPC.notifications.snooze,
    ipcHandler(IPC.notifications.snooze, NotificationSnoozeSchema, ({ kind }) =>
      snoozeNotification(kind)
    )
  )

  ipcMain.handle(
    IPC.notifications.getDisabled,
    ipcHandler(IPC.notifications.getDisabled, z.void(), async () => readDisabledAlerts())
  )

  // Refreshing right away updates the bell without waiting for the next trigger.
  ipcMain.handle(
    IPC.notifications.setEnabled,
    ipcHandler(
      IPC.notifications.setEnabled,
      NotificationSetEnabledSchema,
      async ({ kind, enabled }) => {
        const disabled = setAlertEnabled(kind, enabled)
        await refreshNotifications()
        return disabled
      }
    )
  )
}
