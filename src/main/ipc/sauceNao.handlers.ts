import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC } from '@shared/ipc/contracts'
import { lookupSauceNao } from '../services/sauceNao.service'
import { readSauceNaoApiKey, writeSauceNaoApiKey } from '../services/sauceNaoSettings'
import { readSourceFolder, resolveRoute } from '../services/sourceFolder'

export function registerSauceNaoHandlers(): void {
  ipcMain.handle(
    IPC.sauceNao.lookup,
    ipcHandler(z.string().min(1), (route) => lookupSauceNao(resolveRoute(route, readSourceFolder())))
  )

  ipcMain.handle(
    IPC.sauceNao.getApiKey,
    ipcHandler(z.void(), async () => readSauceNaoApiKey())
  )

  ipcMain.handle(
    IPC.sauceNao.setApiKey,
    ipcHandler(z.string().optional(), async (apiKey) => {
      writeSauceNaoApiKey(apiKey)
    })
  )
}
