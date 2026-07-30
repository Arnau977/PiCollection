import { registerArtistHandlers } from './artist.handlers'
import { registerCharacterHandlers } from './character.handlers'
import { registerMediaHandlers } from './media.handlers'
import { registerTagHandlers } from './tag.handlers'
import { registerSeriesHandlers } from './series.handlers'
import { registerStatsHandlers } from './stats.handlers'
import { registerSystemHandlers } from './system.handlers'
import { registerUpdaterHandlers } from './updater.handlers'

export function registerIpcHandlers(): void {
  registerMediaHandlers()
  registerArtistHandlers()
  registerTagHandlers()
  registerCharacterHandlers()
  registerSeriesHandlers()
  registerStatsHandlers()
  registerSystemHandlers()
  registerUpdaterHandlers()
}
