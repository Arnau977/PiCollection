import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { AutoTagRuleSchema, IPC } from '@shared/ipc/contracts'
import {
  applyDanbooruDefaults,
  getAutoTagStatus,
  setAutoTagRule
} from '../services/autoTags.service'

export function registerAutoTagsHandlers(): void {
  ipcMain.handle(
    IPC.autoTags.getStatus,
    ipcHandler(IPC.autoTags.getStatus, z.void(), () => getAutoTagStatus())
  )
  ipcMain.handle(
    IPC.autoTags.setRule,
    ipcHandler(IPC.autoTags.setRule, AutoTagRuleSchema, (input) => setAutoTagRule(input))
  )
  ipcMain.handle(
    IPC.autoTags.applyDanbooruDefaults,
    ipcHandler(IPC.autoTags.applyDanbooruDefaults, z.void(), () => applyDanbooruDefaults())
  )
}
