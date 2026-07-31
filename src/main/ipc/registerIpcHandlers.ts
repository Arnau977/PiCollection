import { registerArtistHandlers } from './artist.handlers'
import { registerCharacterHandlers } from './character.handlers'
import { registerMediaHandlers } from './media.handlers'
import { registerTagHandlers } from './tag.handlers'
import { registerSeriesHandlers } from './series.handlers'
import { registerStatsHandlers } from './stats.handlers'
import { registerSystemHandlers } from './system.handlers'
import { registerUpdaterHandlers } from './updater.handlers'
import { registerSauceNaoHandlers } from './sauceNao.handlers'
import { registerBackupHandlers } from './backup.handlers'
import { registerMediaMaintenanceHandlers } from './mediaMaintenance.handlers'

export function registerIpcHandlers(): void {
  registerMediaHandlers()
  registerArtistHandlers()
  registerTagHandlers()
  registerCharacterHandlers()
  registerSeriesHandlers()
  registerStatsHandlers()
  registerSystemHandlers()
  registerUpdaterHandlers()
  registerSauceNaoHandlers()
  registerBackupHandlers()
  registerMediaMaintenanceHandlers()
}
