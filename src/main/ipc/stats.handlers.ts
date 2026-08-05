import { ipcMain } from 'electron'
import { z } from 'zod'
import { statsService } from '../services/stats.service'
import { ipcHandler } from './helpers'
import { IPC } from '@shared/ipc/contracts'

export function registerStatsHandlers(): void {
  ipcMain.handle(
    IPC.stats.getSummary,
    ipcHandler(IPC.stats.getSummary, z.void(), () => statsService.getSummary())
  )
}
