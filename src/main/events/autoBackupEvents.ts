import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc/contracts'
import type { AutoBackupStatus } from '@shared/models'

let autoBackupEventsWindow: BrowserWindow | null = null

/** Re-points which window receives auto-backup status pushes - mirrors setEntityEventsWindow. */
export function setAutoBackupEventsWindow(window: BrowserWindow): void {
  autoBackupEventsWindow = window
}

/**
 * Pushes the current status whenever a scheduled run starts/finishes, so an
 * open Settings page (and the Data tab's failure dot) updates without
 * polling - scheduled runs happen with no renderer request to answer.
 */
export function notifyAutoBackupChanged(status: AutoBackupStatus): void {
  if (autoBackupEventsWindow && !autoBackupEventsWindow.isDestroyed()) {
    autoBackupEventsWindow.webContents.send(IPC.autoBackup.changed, status)
  }
}
