import type { Migration } from 'kysely'
import * as m0001InitialSchema from './0001_initial_schema'
import * as m0002Series from './0002_series'
import * as m0003MediaAiGenerated from './0003_media_ai_generated'
import * as m0004MediaHash from './0004_media_hash'
import * as m0005IndexMediaRoute from './0005_index_media_route'

export const migrations: Record<string, Migration> = {
  '0001_initial_schema': m0001InitialSchema,
  '0002_series': m0002Series,
  '0003_media_ai_generated': m0003MediaAiGenerated,
  '0004_media_hash': m0004MediaHash,
  '0005_index_media_route': m0005IndexMediaRoute
}
