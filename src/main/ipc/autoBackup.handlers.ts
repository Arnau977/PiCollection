import { dialog, ipcMain, shell } from 'electron'
import { promises as fs } from 'fs'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { AutoBackupConfigPatchSchema, IPC } from '@shared/ipc/contracts'
import type { AutoBackupStatus } from '@shared/models'
import {
  getAutoBackupStatus,
  runAutoBackup,
  updateAutoBackupConfig
} from '../services/autoBackup.service'

export function registerAutoBackupHandlers(): void {
  ipcMain.handle(
    IPC.autoBackup.getStatus,
    ipcHandler(IPC.autoBackup.getStatus, z.void(), async () => getAutoBackupStatus())
  )

  ipcMain.handle(
    IPC.autoBackup.updateConfig,
    ipcHandler(IPC.autoBackup.updateConfig, AutoBackupConfigPatchSchema, (patch) =>
      updateAutoBackupConfig(patch)
    )
  )

  ipcMain.handle(
    IPC.autoBackup.pickFolder,
    ipcHandler(IPC.autoBackup.pickFolder, z.void(), async (): Promise<AutoBackupStatus> => {
      const result = await dialog.showOpenDialog({
        title: 'Choose automatic backup folder',
        defaultPath: getAutoBackupStatus().resolvedFolder,
        properties: ['openDirectory', 'createDirectory']
      })
      if (result.canceled || result.filePaths.length === 0) return getAutoBackupStatus()
      return updateAutoBackupConfig({ folder: result.filePaths[0] })
    })
  )

  ipcMain.handle(
    IPC.autoBackup.openFolder,
    ipcHandler(IPC.autoBackup.openFolder, z.void(), async () => {
      const folder = getAutoBackupStatus().resolvedFolder
      await fs.mkdir(folder, { recursive: true })
      const error = await shell.openPath(folder)
      if (error) throw new Error(error)
    })
  )

  ipcMain.handle(
    IPC.autoBackup.runNow,
    ipcHandler(IPC.autoBackup.runNow, z.void(), () => runAutoBackup({ force: true }))
  )
}
