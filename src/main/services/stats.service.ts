import { getDb } from '../database/connection'
import * as statsRepo from '../database/repositories/stats.repository'
import type { StatsSummary } from '@shared/models'

const TOP_N = 5

export const statsService = {
  async getSummary(): Promise<StatsSummary> {
    const db = getDb()
    const [topArtists, topTags, topCharacters, topSeries] = await Promise.all([
      statsRepo.topArtistsByMediaCount(db, TOP_N),
      statsRepo.topTagsByMediaCount(db, TOP_N),
      statsRepo.topCharactersByMediaCount(db, TOP_N),
      statsRepo.topSeriesByMediaCount(db, TOP_N)
    ])
    return { topArtists, topTags, topCharacters, topSeries }
  }
}
