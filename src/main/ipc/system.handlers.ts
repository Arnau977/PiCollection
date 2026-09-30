import { app, clipboard, ipcMain, shell } from 'electron'
import { join } from 'path'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC } from '@shared/ipc/contracts'
import { loadImageForClipboard } from '../services/system.service'
import { copyFileToClipboard, isAnimatedImage } from '../services/clipboardFile'
import { logError } from '../logging/logger'
import { readSourceFolder, resolveRoute } from '../services/sourceFolder'
import { getAutoStartStatus, setAutoStart } from '../window/autoStart'

/** Written by scripts/generate-third-party-notices.mjs; unpacked from the asar with resources/. */
function thirdPartyNoticesPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'third-party-notices.txt')
    : join(app.getAppPath(), 'resources', 'third-party-notices.txt')
}

export function registerSystemHandlers(): void {
  ipcMain.handle(
    IPC.system.openThirdPartyNotices,
    ipcHandler(IPC.system.openThirdPartyNotices, z.void(), async () => {
      // openPath resolves to an error message instead of rejecting.
      const error = await shell.openPath(thirdPartyNoticesPath())
      if (error) throw new Error(error)
    })
  )
  ipcMain.handle(
    IPC.system.showInFolder,
    ipcHandler(IPC.system.showInFolder, z.string().min(1), async (route) => {
      shell.showItemInFolder(resolveRoute(route, readSourceFolder()))
    })
  )

  // Unlike `showInFolder`, the path here is already absolute (e.g. a backup
  // file the user just chose a save location for) - it isn't resolved
  // against the library's source folder.
  ipcMain.handle(
    IPC.system.showPathInFolder,
    ipcHandler(IPC.system.showPathInFolder, z.string().min(1), async (path) => {
      shell.showItemInFolder(path)
    })
  )

  ipcMain.handle(
    IPC.system.copyImageToClipboard,
    ipcHandler(IPC.system.copyImageToClipboard, z.string().min(1), async (route) => {
      const filePath = resolveRoute(route, readSourceFolder())
      if (process.platform === 'win32' && (await isAnimatedImage(filePath).catch(() => false))) {
        try {
          await copyFileToClipboard(filePath)
          return
        } catch (err) {
          // Still copy the first frame as an image rather than nothing.
          logError('clipboard', 'copy as file failed', err)
        }
      }
      const image = await loadImageForClipboard(filePath)
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

  ipcMain.handle(
    IPC.system.getAutoStart,
    ipcHandler(IPC.system.getAutoStart, z.void(), async () => getAutoStartStatus())
  )

  ipcMain.handle(
    IPC.system.setAutoStart,
    ipcHandler(IPC.system.setAutoStart, z.boolean(), async (enabled) => setAutoStart(enabled))
  )
}
