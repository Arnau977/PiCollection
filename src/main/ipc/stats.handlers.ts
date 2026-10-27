import { ipcMain } from 'electron'
import { z } from 'zod'
import { statsService } from '../services/stats.service'
import { storageService } from '../services/storage.service'
import { ipcHandler } from './helpers'
import { IPC } from '@shared/ipc/contracts'

export function registerStatsHandlers(): void {
  ipcMain.handle(
    IPC.stats.getSummary,
    ipcHandler(IPC.stats.getSummary, z.void(), () => statsService.getSummary())
  )

  ipcMain.handle(
    IPC.stats.getStorage,
    ipcHandler(IPC.stats.getStorage, z.void(), () => storageService.getOverview())
  )
}
