import { app, clipboard, ipcMain, shell } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC } from '@shared/ipc/contracts'
import { loadImageForClipboard } from '../services/system.service'
import { readSourceFolder, resolveRoute } from '../services/sourceFolder'

export function registerSystemHandlers(): void {
  ipcMain.handle(
    IPC.system.showInFolder,
    ipcHandler(IPC.system.showInFolder, z.string().min(1), async (route) => {
      shell.showItemInFolder(resolveRoute(route, readSourceFolder()))
    })
  )

  ipcMain.handle(
    IPC.system.copyImageToClipboard,
    ipcHandler(IPC.system.copyImageToClipboard, z.string().min(1), async (route) => {
      const image = await loadImageForClipboard(resolveRoute(route, readSourceFolder()))
      if (!image) {
        throw new Error('Could not read image data from that file.')
      }
      clipboard.writeImage(image)
    })
  )

  // The renderer can't resolve a relative route itself - source folder
  // resolution lives in the main process - so "copy location" has to round
  // trip through IPC to put a usable absolute path on the clipboard.
  ipcMain.handle(
    IPC.system.copyLocationToClipboard,
    ipcHandler(IPC.system.copyLocationToClipboard, z.string().min(1), async (route) => {
      clipboard.writeText(resolveRoute(route, readSourceFolder()))
    })
  )

  ipcMain.handle(
    IPC.system.getAppVersion,
    ipcHandler(IPC.system.getAppVersion, z.void(), async () => app.getVersion())
  )

  ipcMain.handle(
    IPC.system.restartApp,
    ipcHandler(IPC.system.restartApp, z.void(), async () => {
      app.relaunch()
      app.exit()
    })
  )
}
