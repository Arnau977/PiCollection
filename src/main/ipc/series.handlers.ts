import { ipcMain } from 'electron'
import { z } from 'zod'
import { seriesService } from '../services/series.service'
import { ipcHandler } from './helpers'
import { IPC, IdSchema, SeriesInputSchema, SeriesUpdateSchema } from '@shared/ipc/contracts'

export function registerSeriesHandlers(): void {
  ipcMain.handle(
    IPC.series.getAll,
    ipcHandler(IPC.series.getAll, z.void(), () => seriesService.getAllSeries())
  )
  ipcMain.handle(
    IPC.series.create,
    ipcHandler(IPC.series.create, SeriesInputSchema, (input) => seriesService.createSeries(input))
  )
  ipcMain.handle(
    IPC.series.update,
    ipcHandler(IPC.series.update, SeriesUpdateSchema, ({ id, input }) =>
      seriesService.updateSeries(id, input)
    )
  )
  ipcMain.handle(
    IPC.series.delete,
    ipcHandler(IPC.series.delete, IdSchema, (id) => seriesService.deleteSeries(id))
  )
}
