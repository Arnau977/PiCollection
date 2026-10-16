import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc/contracts'
import type { AppNotification } from '@shared/models'

let notificationEventsWindow: BrowserWindow | null = null

/** Re-points which window receives tray pushes - mirrors setAutoBackupEventsWindow. */
export function setNotificationEventsWindow(window: BrowserWindow): void {
  notificationEventsWindow = window
}

export function notifyNotificationsChanged(items: AppNotification[]): void {
  if (notificationEventsWindow && !notificationEventsWindow.isDestroyed()) {
    notificationEventsWindow.webContents.send(IPC.notifications.changed, items)
  }
}
