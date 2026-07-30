import { ipcMain } from 'electron'
import { z } from 'zod'
import { characterService } from '../services/character.service'
import { ipcHandler } from './helpers'
import { CharacterInputSchema, CharacterUpdateSchema, IPC, IdSchema } from '@shared/ipc/contracts'

export function registerCharacterHandlers(): void {
  ipcMain.handle(
    IPC.character.getAll,
    ipcHandler(z.void(), () => characterService.getAllCharacters())
  )
  ipcMain.handle(
    IPC.character.create,
    ipcHandler(CharacterInputSchema, (input) => characterService.createCharacter(input))
  )
  ipcMain.handle(
    IPC.character.update,
    ipcHandler(CharacterUpdateSchema, ({ id, input }) =>
      characterService.updateCharacter(id, input)
    )
  )
  ipcMain.handle(
    IPC.character.delete,
    ipcHandler(IdSchema, (id) => characterService.deleteCharacter(id))
  )
}
