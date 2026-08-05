import { dialog, ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { mediaMaintenanceService } from '../services/mediaMaintenance.service'
import { IPC, RelinkMissingFilesSchema, RelinkOneFileSchema } from '@shared/ipc/contracts'
import type { PickFolderResult, RelinkOneResult } from '@shared/models'

export function registerMediaMaintenanceHandlers(): void {
  ipcMain.handle(
    IPC.maintenance.checkMissingFiles,
    ipcHandler(IPC.maintenance.checkMissingFiles, z.void(), () =>
      mediaMaintenanceService.checkMissingFiles()
    )
  )

  ipcMain.handle(
    IPC.maintenance.pickFolder,
    ipcHandler(IPC.maintenance.pickFolder, z.void(), async (): Promise<PickFolderResult> => {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      if (result.canceled || result.filePaths.length === 0) return { cancelled: true }
      return { cancelled: false, path: result.filePaths[0] }
    })
  )

  ipcMain.handle(
    IPC.maintenance.pickFile,
    ipcHandler(IPC.maintenance.pickFile, z.void(), async (): Promise<PickFolderResult> => {
      const result = await dialog.showOpenDialog({ properties: ['openFile'] })
      if (result.canceled || result.filePaths.length === 0) return { cancelled: true }
      return { cancelled: false, path: result.filePaths[0] }
    })
  )

  ipcMain.handle(
    IPC.maintenance.relinkMissingFiles,
    ipcHandler(
      IPC.maintenance.relinkMissingFiles,
      RelinkMissingFilesSchema,
      ({ oldRoot, newRoot }) => mediaMaintenanceService.relinkMissingFiles(oldRoot, newRoot)
    )
  )

  ipcMain.handle(
    IPC.maintenance.relinkOne,
    ipcHandler(
      IPC.maintenance.relinkOne,
      RelinkOneFileSchema,
      ({ mediaId, newRoute }): Promise<RelinkOneResult> =>
        mediaMaintenanceService.relinkOne(mediaId, newRoute)
    )
  )
}
