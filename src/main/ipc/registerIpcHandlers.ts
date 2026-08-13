import { registerArtistHandlers } from './artist.handlers'
import { registerCharacterHandlers } from './character.handlers'
import { registerMediaHandlers } from './media.handlers'
import { registerTagHandlers } from './tag.handlers'
import { registerSeriesHandlers } from './series.handlers'
import { registerStatsHandlers } from './stats.handlers'
import { registerSystemHandlers } from './system.handlers'
import { registerUpdaterHandlers } from './updater.handlers'
import { registerSauceNaoHandlers } from './sauceNao.handlers'
import { registerDanbooruAutocompleteHandlers } from './danbooruAutocomplete.handlers'
import { registerBackupHandlers } from './backup.handlers'
import { registerMediaMaintenanceHandlers } from './mediaMaintenance.handlers'
import { registerSourceFolderHandlers } from './sourceFolder.handlers'
import { registerLoggingHandlers } from './logging.handlers'

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
  registerDanbooruAutocompleteHandlers()
  registerBackupHandlers()
  registerMediaMaintenanceHandlers()
  registerSourceFolderHandlers()
  registerLoggingHandlers()
}
