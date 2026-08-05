import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import {
  IPC,
  SourceFolderBrowsePathSchema,
  SourceFolderExpandSelectionSchema,
  SourceFolderPathSchema
} from '@shared/ipc/contracts'
import { readSourceFolder } from '../services/sourceFolder'
import { sourceFolderBrowserService } from '../services/sourceFolderBrowser.service'
import { sourceFolderMigrationService } from '../services/sourceFolderMigration.service'

export function registerSourceFolderHandlers(): void {
  ipcMain.handle(
    IPC.sourceFolder.get,
    ipcHandler(IPC.sourceFolder.get, z.void(), async () => readSourceFolder())
  )

  ipcMain.handle(
    IPC.sourceFolder.scanMigration,
    ipcHandler(IPC.sourceFolder.scanMigration, SourceFolderPathSchema, ({ path }) =>
      sourceFolderMigrationService.scan(path)
    )
  )

  ipcMain.handle(
    IPC.sourceFolder.applyMigration,
    ipcHandler(IPC.sourceFolder.applyMigration, SourceFolderPathSchema, ({ path }) =>
      sourceFolderMigrationService.apply(path)
    )
  )

  ipcMain.handle(
    IPC.sourceFolder.browse,
    ipcHandler(IPC.sourceFolder.browse, SourceFolderBrowsePathSchema, ({ relativePath }) =>
      sourceFolderBrowserService.browse(relativePath)
    )
  )

  ipcMain.handle(
    IPC.sourceFolder.expandSelection,
    ipcHandler(IPC.sourceFolder.expandSelection, SourceFolderExpandSelectionSchema, (selection) =>
      sourceFolderBrowserService.expandSelection(selection)
    )
  )
}
