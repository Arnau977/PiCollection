import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc/contracts'

let autoImportEventsWindow: BrowserWindow | null = null

/** Re-points which window receives auto-import pushes - mirrors setAutoBackupEventsWindow. */
export function setAutoImportEventsWindow(window: BrowserWindow): void {
  autoImportEventsWindow = window
}

/** "N pictures added to Pending" - one push per processed batch. */
export function notifyAutoImported(count: number): void {
  if (autoImportEventsWindow && !autoImportEventsWindow.isDestroyed()) {
    autoImportEventsWindow.webContents.send(IPC.autoImport.added, count)
  }
}
