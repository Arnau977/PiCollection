import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC } from '@shared/ipc/contracts'
import {
  checkForUpdates,
  downloadUpdate,
  getChannel,
  quitAndInstall,
  setChannel
} from '../updater/autoUpdater'

const UpdateChannelSchema = z.enum(['stable', 'beta'])

export function registerUpdaterHandlers(): void {
  ipcMain.handle(
    IPC.updater.checkForUpdates,
    ipcHandler(z.void(), () => checkForUpdates())
  )

  ipcMain.handle(
    IPC.updater.downloadUpdate,
    ipcHandler(z.void(), () => downloadUpdate())
  )

  ipcMain.handle(
    IPC.updater.quitAndInstall,
    ipcHandler(z.void(), async () => quitAndInstall())
  )

  ipcMain.handle(
    IPC.updater.getChannel,
    ipcHandler(z.void(), async () => getChannel())
  )

  ipcMain.handle(
    IPC.updater.setChannel,
    ipcHandler(UpdateChannelSchema, async (channel) => setChannel(channel))
  )
}
