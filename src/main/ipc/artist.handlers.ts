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
    ipcHandler(IPC.artist.getAll, z.void(), () => artistService.getAllArtists())
  )
  ipcMain.handle(
    IPC.artist.create,
    ipcHandler(IPC.artist.create, ArtistInputSchema, (input) => artistService.createArtist(input))
  )
  ipcMain.handle(
    IPC.artist.update,
    ipcHandler(IPC.artist.update, ArtistUpdateSchema, ({ id, input }) =>
      artistService.updateArtist(id, input)
    )
  )
  ipcMain.handle(
    IPC.artist.delete,
    ipcHandler(IPC.artist.delete, IdSchema, (id) => artistService.deleteArtist(id))
  )
  ipcMain.handle(
    IPC.artist.addSocialLink,
    ipcHandler(IPC.artist.addSocialLink, AddSocialLinkSchema, ({ artistId, socialLink }) =>
      artistService.addSocialLink(artistId, socialLink)
    )
  )
  ipcMain.handle(
    IPC.artist.removeSocialLink,
    ipcHandler(
      IPC.artist.removeSocialLink,
      RemoveSocialLinkSchema,
      ({ artistId, socialLinkId }) => artistService.removeSocialLink(artistId, socialLinkId)
    )
  )
}
