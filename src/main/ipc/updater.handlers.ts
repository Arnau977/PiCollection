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
    ipcHandler(IPC.updater.checkForUpdates, z.void(), () => checkForUpdates())
  )

  ipcMain.handle(
    IPC.updater.downloadUpdate,
    ipcHandler(IPC.updater.downloadUpdate, z.void(), () => downloadUpdate())
  )

  ipcMain.handle(
    IPC.updater.quitAndInstall,
    ipcHandler(IPC.updater.quitAndInstall, z.void(), async () => quitAndInstall())
  )

  ipcMain.handle(
    IPC.updater.getChannel,
    ipcHandler(IPC.updater.getChannel, z.void(), async () => getChannel())
  )

  ipcMain.handle(
    IPC.updater.setChannel,
    ipcHandler(IPC.updater.setChannel, UpdateChannelSchema, async (channel) => setChannel(channel))
  )
}
