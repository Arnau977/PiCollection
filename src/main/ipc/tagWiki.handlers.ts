import { ipcMain } from 'electron'
import { z } from 'zod'
import { ipcHandler } from './helpers'
import { IPC } from '@shared/ipc/contracts'
import { lookupTagWiki } from '../services/tagWiki.service'

export function registerTagWikiHandlers(): void {
  ipcMain.handle(
    IPC.tagWiki.lookup,
    ipcHandler(IPC.tagWiki.lookup, z.string().min(1), (tagName) => lookupTagWiki(tagName))
  )
}
