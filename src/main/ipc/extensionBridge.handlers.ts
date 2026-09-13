import { ipcMain } from 'electron'
import { z } from 'zod'
import {
  ExtensionBridgeSetBackgroundModeSchema,
  ExtensionBridgeSetEnabledSchema,
  IPC
} from '@shared/ipc/contracts'
import { ipcHandler } from './helpers'
import {
  getExtensionBridgeStatus,
  regenerateExtensionBridgeTokenAction,
  setExtensionBridgeBackgroundMode,
  setExtensionBridgeEnabled
} from '../services/extensionBridge.server'

export function registerExtensionBridgeHandlers(): void {
  ipcMain.handle(
    IPC.extensionBridge.getStatus,
    ipcHandler(IPC.extensionBridge.getStatus, z.void(), async () => getExtensionBridgeStatus())
  )

  ipcMain.handle(
    IPC.extensionBridge.setEnabled,
    ipcHandler(IPC.extensionBridge.setEnabled, ExtensionBridgeSetEnabledSchema, ({ enabled }) =>
      setExtensionBridgeEnabled(enabled)
    )
  )

  ipcMain.handle(
    IPC.extensionBridge.setBackgroundMode,
    ipcHandler(
      IPC.extensionBridge.setBackgroundMode,
      ExtensionBridgeSetBackgroundModeSchema,
      async ({ enabled }) => setExtensionBridgeBackgroundMode(enabled)
    )
  )

  ipcMain.handle(
    IPC.extensionBridge.regenerateToken,
    ipcHandler(IPC.extensionBridge.regenerateToken, z.void(), async () =>
      regenerateExtensionBridgeTokenAction()
    )
  )
}
