import { ipcMain, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC } from '@shared/ipc/contracts'
import type { Wd14RuntimeEvent } from '@shared/models'
import {
  getWd14RuntimeStatus,
  installWd14Runtime,
  removeWd14Runtime
} from '../services/wd14Runtime.service'

let eventWindow: BrowserWindow | null = null

/** Re-points which window receives progress events - call whenever a new main window is created, same as `setUpdaterWindow`. */
export function setWd14RuntimeWindow(window: BrowserWindow): void {
  eventWindow = window
}

function send(event: Wd14RuntimeEvent): void {
  if (eventWindow && !eventWindow.isDestroyed()) {
    eventWindow.webContents.send(IPC.wd14Runtime.event, event)
  }
}

export function registerWd14RuntimeHandlers(): void {
  ipcMain.handle(
    IPC.wd14Runtime.getStatus,
    ipcHandler(IPC.wd14Runtime.getStatus, z.void(), async () => getWd14RuntimeStatus())
  )

  ipcMain.handle(
    IPC.wd14Runtime.install,
    ipcHandler(IPC.wd14Runtime.install, z.void(), () => installWd14Runtime(send))
  )

  ipcMain.handle(
    IPC.wd14Runtime.remove,
    ipcHandler(IPC.wd14Runtime.remove, z.void(), () => removeWd14Runtime())
  )
}
