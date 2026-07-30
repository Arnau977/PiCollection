import { app } from 'electron'
import path from 'path'

export function resolveElectronDbPath(): string {
  const fileName = app.isPackaged ? 'picollection.sqlite' : 'picollection.dev.sqlite'
  return path.join(app.getPath('userData'), fileName)
}
