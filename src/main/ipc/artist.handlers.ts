import { ipcMain } from 'electron'
import { z } from 'zod'
import { artistService } from '../services/artist.service'
import { ipcHandler } from './helpers'
import {
  AddSocialLinkSchema,
  ArtistInputSchema,
  ArtistUpdateSchema,
  IPC,
  IdSchema,
  RemoveSocialLinkSchema
} from '@shared/ipc/contracts'

export function registerArtistHandlers(): void {
  ipcMain.handle(
    IPC.artist.getAll,
    ipcHandler(z.void(), () => artistService.getAllArtists())
  )
  ipcMain.handle(
    IPC.artist.create,
    ipcHandler(ArtistInputSchema, (input) => artistService.createArtist(input))
  )
  ipcMain.handle(
    IPC.artist.update,
    ipcHandler(ArtistUpdateSchema, ({ id, input }) => artistService.updateArtist(id, input))
  )
  ipcMain.handle(
    IPC.artist.delete,
    ipcHandler(IdSchema, (id) => artistService.deleteArtist(id))
  )
  ipcMain.handle(
    IPC.artist.addSocialLink,
    ipcHandler(AddSocialLinkSchema, ({ artistId, socialLink }) =>
      artistService.addSocialLink(artistId, socialLink)
    )
  )
  ipcMain.handle(
    IPC.artist.removeSocialLink,
    ipcHandler(RemoveSocialLinkSchema, ({ artistId, socialLinkId }) =>
      artistService.removeSocialLink(artistId, socialLinkId)
    )
  )
}
