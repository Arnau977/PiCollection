import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { DanbooruCredentialsInputSchema, IPC } from '@shared/ipc/contracts'
import type { DanbooruCredentials } from '@shared/models'
import { autocompleteDanbooruTags } from '../services/danbooruAutocomplete.service'
import { resolveDanbooruUserId } from '../services/danbooruCredentials.service'
import { readDanbooruCredentials, writeDanbooruCredentials } from '../services/danbooruSettings'

export function registerDanbooruAutocompleteHandlers(): void {
  ipcMain.handle(
    IPC.danbooru.autocompleteTags,
    ipcHandler(IPC.danbooru.autocompleteTags, z.string().min(1), (query) =>
      autocompleteDanbooruTags(query)
    )
  )

  ipcMain.handle(
    IPC.danbooru.getCredentials,
    ipcHandler(
      IPC.danbooru.getCredentials,
      z.void(),
      async (): Promise<DanbooruCredentials | undefined> => {
        const credentials = readDanbooruCredentials()
        return credentials && { username: credentials.username, apiKey: credentials.apiKey }
      }
    )
  )

  ipcMain.handle(
    IPC.danbooru.setCredentials,
    ipcHandler(
      IPC.danbooru.setCredentials,
      DanbooruCredentialsInputSchema.optional(),
      async (input) => {
        if (!input) {
          writeDanbooruCredentials(undefined)
          return
        }
        const userId = await resolveDanbooruUserId(input.username, input.apiKey)
        writeDanbooruCredentials({ username: input.username, apiKey: input.apiKey, userId })
      }
    )
  )
}
