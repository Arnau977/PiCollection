import { dialog, ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { createBackupZip, restoreBackupZip } from '../services/backupService'
import { BackupExportSchema, IPC } from '@shared/ipc/contracts'
import type { BackupExportResult, BackupImportResult } from '@shared/models'

export function registerBackupHandlers(): void {
  ipcMain.handle(
    IPC.backup.export,
    ipcHandler(BackupExportSchema, async ({ gallerySettings }): Promise<BackupExportResult> => {
      const result = await dialog.showSaveDialog({
        title: 'Export backup',
        defaultPath: `picollection-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'PiCollection backup', extensions: ['zip'] }]
      })
      if (result.canceled || !result.filePath) return { cancelled: true }

      await createBackupZip(result.filePath, gallerySettings)
      return { cancelled: false }
    })
  )

  ipcMain.handle(
    IPC.backup.import,
    ipcHandler(z.void(), async (): Promise<BackupImportResult> => {
      const result = await dialog.showOpenDialog({
        title: 'Import backup',
        properties: ['openFile'],
        filters: [{ name: 'PiCollection backup', extensions: ['zip'] }]
      })
      if (result.canceled || result.filePaths.length === 0) return { cancelled: true }

      const { gallerySettings } = await restoreBackupZip(result.filePaths[0])
      return { cancelled: false, gallerySettings: gallerySettings ?? undefined }
    })
  )
}
