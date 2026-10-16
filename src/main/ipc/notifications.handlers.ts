import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC, NotificationSnoozeSchema } from '@shared/ipc/contracts'
import {
  refreshNotifications,
  refreshSourceFolderScanIfStale,
  snoozeNotification
} from '../services/notifications/notifications.service'

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
}
