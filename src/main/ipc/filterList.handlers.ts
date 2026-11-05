import { ipcMain } from 'electron'
import { z } from 'zod'
import { filterListService } from '../services/filterList.service'
import { ipcHandler } from './helpers'
import { FilterListInputSchema, FilterListUpdateSchema, IPC, IdSchema } from '@shared/ipc/contracts'

export function registerFilterListHandlers(): void {
  ipcMain.handle(
    IPC.filterList.getAll,
    ipcHandler(IPC.filterList.getAll, z.void(), () => filterListService.getAll())
  )
  ipcMain.handle(
    IPC.filterList.create,
    ipcHandler(IPC.filterList.create, FilterListInputSchema, (input) =>
      filterListService.create(input)
    )
  )
  ipcMain.handle(
    IPC.filterList.update,
    ipcHandler(IPC.filterList.update, FilterListUpdateSchema, ({ id, input }) =>
      filterListService.update(id, input)
    )
  )
  ipcMain.handle(
    IPC.filterList.delete,
    ipcHandler(IPC.filterList.delete, IdSchema, (id) => filterListService.delete(id))
  )
}
