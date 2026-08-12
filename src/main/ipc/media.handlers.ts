import { ipcMain } from 'electron'
import { mediaService } from '../services/media.service'
import { cacheThumbnailFromBuffer, THUMBNAIL_MAX_SIZE } from '../thumbnails/thumbnails'
import { ipcHandler } from './helpers'
import { readSourceFolder, resolveRoute } from '../services/sourceFolder'
import {
  CacheThumbnailSchema,
  IPC,
  IdSchema,
  MediaBatchUpdateAssociationsSchema,
  MediaGetEntityThumbnailsSchema,
  MediaGetFilteredSchema,
  MediaInputSchema,
  MediaUpdateSchema,
  RouteSchema
} from '@shared/ipc/contracts'

export function registerMediaHandlers(): void {
  ipcMain.handle(
    IPC.media.getFiltered,
    ipcHandler(IPC.media.getFiltered, MediaGetFilteredSchema, ({ filters, sorting }) =>
      mediaService.getMediaFiltered(filters, sorting)
    )
  )
  ipcMain.handle(
    IPC.media.getOrderedIds,
    ipcHandler(IPC.media.getOrderedIds, MediaGetFilteredSchema, ({ filters, sorting }) =>
      mediaService.getMediaOrderedIds(filters, sorting)
    )
  )
  ipcMain.handle(
    IPC.media.getEntityThumbnails,
    ipcHandler(IPC.media.getEntityThumbnails, MediaGetEntityThumbnailsSchema, ({ kind, ids }) =>
      mediaService.getEntityThumbnails(kind, ids)
    )
  )
  ipcMain.handle(
    IPC.media.getById,
    ipcHandler(IPC.media.getById, IdSchema, (id) => mediaService.getMediaById(id))
  )
  ipcMain.handle(
    IPC.media.create,
    ipcHandler(IPC.media.create, MediaInputSchema, (input) => mediaService.addMedia(input))
  )
  ipcMain.handle(
    IPC.media.update,
    ipcHandler(IPC.media.update, MediaUpdateSchema, ({ id, input }) =>
      mediaService.updateMedia(id, input)
    )
  )
  ipcMain.handle(
    IPC.media.batchUpdateAssociations,
    ipcHandler(IPC.media.batchUpdateAssociations, MediaBatchUpdateAssociationsSchema, (input) =>
      mediaService.batchUpdateAssociations(input)
    )
  )
  ipcMain.handle(
    IPC.media.clearPendingTagging,
    ipcHandler(IPC.media.clearPendingTagging, IdSchema, (id) => mediaService.clearPendingTagging(id))
  )
  ipcMain.handle(
    IPC.media.delete,
    ipcHandler(IPC.media.delete, IdSchema, (id) => mediaService.deleteMedia(id))
  )
  ipcMain.handle(
    IPC.media.cacheThumbnail,
    ipcHandler(IPC.media.cacheThumbnail, CacheThumbnailSchema, ({ route, png }) =>
      cacheThumbnailFromBuffer(
        resolveRoute(route, readSourceFolder()),
        THUMBNAIL_MAX_SIZE,
        Buffer.from(png)
      )
    )
  )
  ipcMain.handle(
    IPC.media.checkDuplicate,
    ipcHandler(IPC.media.checkDuplicate, RouteSchema, ({ route }) =>
      mediaService.checkDuplicate(route)
    )
  )
}
