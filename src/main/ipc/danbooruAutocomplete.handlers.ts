import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC } from '@shared/ipc/contracts'
import { autocompleteDanbooruTags } from '../services/danbooruAutocomplete.service'

export function registerDanbooruAutocompleteHandlers(): void {
  ipcMain.handle(
    IPC.danbooru.autocompleteTags,
    ipcHandler(IPC.danbooru.autocompleteTags, z.string().min(1), (query) =>
      autocompleteDanbooruTags(query)
    )
  )
}
