import { sql } from 'kysely'

/**
 * Per-entity media counts, split so pending media (not yet part of the
 * library) never inflates what the Metadata page shows, while a delete
 * confirmation can still account for it. Both expressions expect `media`
 * joined into the query (a left join: an entity with no media counts 0).
 */
export interface MediaCounts {
  library: number
  pending: number
}

export const libraryCountExpr = sql<number>`coalesce(sum(case when media.pending_tagging = 0 then 1 else 0 end), 0)`
export const pendingCountExpr = sql<number>`coalesce(sum(case when media.pending_tagging = 1 then 1 else 0 end), 0)`

export function toCountsById(
  rows: { id: string; library: number | string; pending: number | string }[]
): Record<string, MediaCounts> {
  return Object.fromEntries(
    rows.map((row) => [row.id, { library: Number(row.library), pending: Number(row.pending) }])
  )
}

export const NO_MEDIA: MediaCounts = { library: 0, pending: 0 }
