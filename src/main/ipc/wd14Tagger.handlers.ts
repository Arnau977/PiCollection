import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC, ImagePngSchema } from '@shared/ipc/contracts'
import { suggestTags, suggestTagsForImage } from '../services/wd14Tagger.service'
import { readSourceFolder, resolveRoute } from '../services/sourceFolder'

export function registerWd14TaggerHandlers(): void {
  ipcMain.handle(
    IPC.wd14Tagger.suggestTags,
    ipcHandler(IPC.wd14Tagger.suggestTags, z.string().min(1), (route) =>
      suggestTags(resolveRoute(route, readSourceFolder()))
    )
  )
  ipcMain.handle(
    IPC.wd14Tagger.suggestTagsForImage,
    ipcHandler(IPC.wd14Tagger.suggestTagsForImage, ImagePngSchema, (png) =>
      suggestTagsForImage(png)
    )
  )
}
