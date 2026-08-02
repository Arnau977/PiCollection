import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC, SourceFolderPathSchema } from '@shared/ipc/contracts'
import { readSourceFolder } from '../services/sourceFolder'
import { sourceFolderMigrationService } from '../services/sourceFolderMigration.service'

export function registerSourceFolderHandlers(): void {
  ipcMain.handle(
    IPC.sourceFolder.get,
    ipcHandler(z.void(), async () => readSourceFolder())
  )

  ipcMain.handle(
    IPC.sourceFolder.scanMigration,
    ipcHandler(SourceFolderPathSchema, ({ path }) => sourceFolderMigrationService.scan(path))
  )

  ipcMain.handle(
    IPC.sourceFolder.applyMigration,
    ipcHandler(SourceFolderPathSchema, ({ path }) => sourceFolderMigrationService.apply(path))
  )
}
