import { ipcMain } from 'electron'
import { z } from 'zod'
import { seriesService } from '../services/series.service'
import { ipcHandler } from './helpers'
import { IPC, IdSchema, SeriesInputSchema, SeriesUpdateSchema } from '@shared/ipc/contracts'

export function registerSeriesHandlers(): void {
  ipcMain.handle(
    IPC.series.getAll,
    ipcHandler(z.void(), () => seriesService.getAllSeries())
  )
  ipcMain.handle(
    IPC.series.create,
    ipcHandler(SeriesInputSchema, (input) => seriesService.createSeries(input))
  )
  ipcMain.handle(
    IPC.series.update,
    ipcHandler(SeriesUpdateSchema, ({ id, input }) => seriesService.updateSeries(id, input))
  )
  ipcMain.handle(
    IPC.series.delete,
    ipcHandler(IdSchema, (id) => seriesService.deleteSeries(id))
  )
}
