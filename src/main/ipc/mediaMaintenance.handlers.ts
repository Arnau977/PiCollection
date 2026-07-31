import { dialog, ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { mediaMaintenanceService } from '../services/mediaMaintenance.service'
import { IPC, RelinkMissingFilesSchema } from '@shared/ipc/contracts'
import type { PickFolderResult } from '@shared/models'

export function registerMediaMaintenanceHandlers(): void {
  ipcMain.handle(
    IPC.maintenance.checkMissingFiles,
    ipcHandler(z.void(), () => mediaMaintenanceService.checkMissingFiles())
  )

  ipcMain.handle(
    IPC.maintenance.pickFolder,
    ipcHandler(z.void(), async (): Promise<PickFolderResult> => {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      if (result.canceled || result.filePaths.length === 0) return { cancelled: true }
      return { cancelled: false, path: result.filePaths[0] }
    })
  )

  ipcMain.handle(
    IPC.maintenance.relinkMissingFiles,
    ipcHandler(RelinkMissingFilesSchema, ({ oldRoot, newRoot }) =>
      mediaMaintenanceService.relinkMissingFiles(oldRoot, newRoot)
    )
  )
}
