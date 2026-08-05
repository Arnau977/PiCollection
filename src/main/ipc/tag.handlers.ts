import { ipcMain } from 'electron'
import { z } from 'zod'
import { tagService } from '../services/tag.service'
import { ipcHandler } from './helpers'
import { IPC, IdSchema, TagInputSchema, TagUpdateSchema } from '@shared/ipc/contracts'

export function registerTagHandlers(): void {
  ipcMain.handle(
    IPC.tag.getAll,
    ipcHandler(IPC.tag.getAll, z.void(), () => tagService.getAllTags())
  )
  ipcMain.handle(
    IPC.tag.create,
    ipcHandler(IPC.tag.create, TagInputSchema, (input) => tagService.createTag(input))
  )
  ipcMain.handle(
    IPC.tag.update,
    ipcHandler(IPC.tag.update, TagUpdateSchema, ({ id, input }) => tagService.updateTag(id, input))
  )
  ipcMain.handle(
    IPC.tag.delete,
    ipcHandler(IPC.tag.delete, IdSchema, (id) => tagService.deleteTag(id))
  )
}
