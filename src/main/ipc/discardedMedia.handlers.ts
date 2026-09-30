import { ipcMain } from 'electron'
import { z } from 'zod'
import { discardedMediaService } from '../services/discardedMedia.service'
import { ipcHandler } from './helpers'
import { DiscardFileSchema, IPC, IdListSchema, IdSchema } from '@shared/ipc/contracts'

export function registerDiscardedMediaHandlers(): void {
  ipcMain.handle(
    IPC.discardedMedia.list,
    ipcHandler(IPC.discardedMedia.list, z.void(), () => discardedMediaService.list())
  )
  ipcMain.handle(
    IPC.discardedMedia.discardFile,
    ipcHandler(IPC.discardedMedia.discardFile, DiscardFileSchema, (input) =>
      discardedMediaService.discardFile(input)
    )
  )
  ipcMain.handle(
    IPC.discardedMedia.trashFiles,
    ipcHandler(IPC.discardedMedia.trashFiles, IdListSchema, (ids) =>
      discardedMediaService.trashFiles(ids)
    )
  )
  ipcMain.handle(
    IPC.discardedMedia.keepFile,
    ipcHandler(IPC.discardedMedia.keepFile, IdSchema, (id) => discardedMediaService.keepFile(id))
  )
}
