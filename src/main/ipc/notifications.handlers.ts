import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC, NotificationSetEnabledSchema, NotificationSnoozeSchema } from '@shared/ipc/contracts'
import {
  refreshNotifications,
  refreshSourceFolderScanIfStale,
  snoozeNotification
} from '../services/notifications/notifications.service'
import { readAlertSettings, setAlertEnabled } from '../services/notifications/notificationSettings'

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
    IPC.notifications.getAlerts,
    ipcHandler(IPC.notifications.getAlerts, z.void(), async () => readAlertSettings())
  )

  // Refreshing right away updates the bell without waiting for the next trigger.
  ipcMain.handle(
    IPC.notifications.setEnabled,
    ipcHandler(
      IPC.notifications.setEnabled,
      NotificationSetEnabledSchema,
      async ({ kind, enabled }) => {
        const alerts = setAlertEnabled(kind, enabled)
        await refreshNotifications()
        return alerts
      }
    )
  )
}
