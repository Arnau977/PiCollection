import { ipcMain, shell } from 'electron'
import { mkdirSync } from 'fs'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC } from '@shared/ipc/contracts'
import { logError } from '../logging/logger'
import { logsDir } from '../logging/rotation'
import { readLoggingEnabled, writeLoggingEnabled } from '../logging/loggingSettings'

const ReportRendererErrorSchema = z.object({
  message: z.string(),
  stack: z.string().optional()
})

export function registerLoggingHandlers(): void {
  ipcMain.handle(
    IPC.logging.getEnabled,
    ipcHandler(IPC.logging.getEnabled, z.void(), async () => readLoggingEnabled())
  )

  ipcMain.handle(
    IPC.logging.setEnabled,
    ipcHandler(IPC.logging.setEnabled, z.boolean(), async (enabled) => {
      writeLoggingEnabled(enabled)
    })
  )

  ipcMain.handle(
    IPC.logging.openFolder,
    ipcHandler(IPC.logging.openFolder, z.void(), async () => {
      mkdirSync(logsDir(), { recursive: true })
      await shell.openPath(logsDir())
    })
  )

  // Deliberately not wrapped in ipcHandler: this channel's entire purpose is
  // to write an error into the log, so tracing its own success/failure
  // through the same wrapper as every other channel would be circular noise.
  ipcMain.handle(IPC.logging.reportRendererError, (_event, rawInput: unknown) => {
    const parsed = ReportRendererErrorSchema.safeParse(rawInput)
    if (!parsed.success) return
    logError(
      'renderer',
      parsed.data.message || '(no message)',
      parsed.data.stack ? { stack: parsed.data.stack } : undefined
    )
  })
}
