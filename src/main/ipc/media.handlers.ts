import { ipcMain } from 'electron'
import { z } from 'zod'
import { mediaService } from '../services/media.service'
import { cacheThumbnailFromBuffer, THUMBNAIL_MAX_SIZE } from '../thumbnails/thumbnails'
import { ipcHandler } from './helpers'
import {
  CacheThumbnailSchema,
  IPC,
  IdSchema,
  MediaGetFilteredSchema,
  MediaInputSchema,
  MediaUpdateSchema,
  RouteSchema
} from '@shared/ipc/contracts'

export function registerMediaHandlers(): void {
  ipcMain.handle(
    IPC.media.getAll,
    ipcHandler(z.void(), () => mediaService.getAllMedia())
  )
  ipcMain.handle(
    IPC.media.getFiltered,
    ipcHandler(MediaGetFilteredSchema, ({ filters, sorting }) =>
      mediaService.getMediaFiltered(filters, sorting)
    )
  )
  ipcMain.handle(
    IPC.media.getById,
    ipcHandler(IdSchema, (id) => mediaService.getMediaById(id))
  )
  ipcMain.handle(
    IPC.media.create,
    ipcHandler(MediaInputSchema, (input) => mediaService.addMedia(input))
  )
  ipcMain.handle(
    IPC.media.update,
    ipcHandler(MediaUpdateSchema, ({ id, input }) => mediaService.updateMedia(id, input))
  )
  ipcMain.handle(
    IPC.media.delete,
    ipcHandler(IdSchema, (id) => mediaService.deleteMedia(id))
  )
  ipcMain.handle(
    IPC.media.cacheThumbnail,
    ipcHandler(CacheThumbnailSchema, ({ route, png }) =>
      cacheThumbnailFromBuffer(route, THUMBNAIL_MAX_SIZE, Buffer.from(png))
    )
  )
  ipcMain.handle(
    IPC.media.checkDuplicate,
    ipcHandler(RouteSchema, ({ route }) => mediaService.checkDuplicate(route))
  )
}
