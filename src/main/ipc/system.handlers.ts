import { app, clipboard, ipcMain, shell } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC } from '@shared/ipc/contracts'
import { loadImageForClipboard } from '../services/system.service'

export function registerSystemHandlers(): void {
  ipcMain.handle(
    IPC.system.showInFolder,
    ipcHandler(z.string().min(1), async (route) => {
      shell.showItemInFolder(route)
    })
  )

  ipcMain.handle(
    IPC.system.copyImageToClipboard,
    ipcHandler(z.string().min(1), async (route) => {
      const image = await loadImageForClipboard(route)
      if (!image) {
        throw new Error('Could not read image data from that file.')
      }
      clipboard.writeImage(image)
    })
  )

  ipcMain.handle(
    IPC.system.getAppVersion,
    ipcHandler(z.void(), async () => app.getVersion())
  )
}
