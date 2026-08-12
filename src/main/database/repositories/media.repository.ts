import type { Expression, ExpressionBuilder, Kysely, SelectQueryBuilder, SqlBool } from 'kysely'
import { sql } from 'kysely'
import type { DB, MediaTable } from '../schema'
import type { MediaFilters, Sorting } from '@shared/models'
import { extractAiToken, parseSearchQuery, type QueryNode } from '@shared/query/searchQuery'

const SORT_COLUMNS: Record<string, keyof MediaTable> = {
  name: 'name',
  createdAt: 'created_at',
  sfw: 'sfw'
}

const DEFAULT_LIMIT = 200

/**
 * Builds an `id IN (...)` subquery for a single AND-group: media matching every
 * id in `ids` (via COUNT DISTINCT) when there is more than one, or a plain `IN`
 * when there's just one - both expressed against the given junction table.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inferred Kysely SelectQueryBuilder generic is impractical to spell out
function buildAndGroupSubquery(
  db: Kysely<DB>,
  table: 'media_tag' | 'media_character',
  column: 'tag_id' | 'character_id',
  ids: string[]
) {
  let sub = db.selectFrom(table).select('media_id').where(column, 'in', ids)
  if (ids.length > 1) {
    sub = sub.groupBy('media_id').having((e) => e.fn.count(column).distinct(), '=', ids.length)
  }
  return sub
}

/** Combines a filter's OR-of-AND-groups into a single WHERE clause: media matching at least one group. */
function applyGroupedFilter<O>(
  qb: SelectQueryBuilder<DB, 'media', O>,
  db: Kysely<DB>,
  table: 'media_tag' | 'media_character',
  column: 'tag_id' | 'character_id',
  groups: string[][] | undefined
): SelectQueryBuilder<DB, 'media', O> {
  const nonEmptyGroups = (groups ?? []).filter((group) => group.length > 0)
  if (!nonEmptyGroups.length) return qb

  return qb.where((eb) =>
    eb.or(
      nonEmptyGroups.map((group) =>
        eb('media.id', 'in', buildAndGroupSubquery(db, table, column, group))
      )
    )
  )
}

/**
 * Same OR-of-AND-groups shape as `applyGroupedFilter`, but each id inside a group first expands
 * to its hierarchy closure (itself + descendants) via `closures` before being ANDed - so "media
 * must match series/character A AND B" really means "must be in A's closure AND in B's closure",
 * not just carry exactly those two ids. Used for both `seriesGroups` and `characterGroups`.
 */
function applyClosureGroupedFilter<O>(
  qb: SelectQueryBuilder<DB, 'media', O>,
  db: Kysely<DB>,
  table: 'media_series' | 'media_character',
  column: 'series_id' | 'character_id',
  groups: string[][] | undefined,
  closures?: Map<string, string[]>
): SelectQueryBuilder<DB, 'media', O> {
  const nonEmptyGroups = (groups ?? []).filter((group) => group.length > 0)
  if (!nonEmptyGroups.length) return qb
  const closureFor = (id: string): string[] => closures?.get(id) ?? [id]

  return qb.where((eb) =>
    eb.or(
      nonEmptyGroups.map((group) =>
        eb.and(
          group.map((id) =>
            eb(
              'media.id',
              'in',
              db.selectFrom(table).select('media_id').where(column, 'in', closureFor(id))
            )
          )
        )
      )
    )
  )
}

/**
 * A search term matches media whose own name, artist, or any linked tag,
 * character or series contains the text.
 */
function compileTerm(eb: ExpressionBuilder<DB, 'media'>, term: string): Expression<SqlBool> {
  const pattern = `%${term}%`

  return eb.or([
    eb(
      'media.id',
      'in',
      eb
        .selectFrom('media_tag')
        .innerJoin('tag', 'tag.id', 'media_tag.tag_id')
        .select('media_tag.media_id')
        .where('tag.name', 'like', pattern)
    ),
    eb(
      'media.id',
      'in',
      eb
        .selectFrom('media_character')
        .innerJoin('character', 'character.id', 'media_character.character_id')
        .select('media_character.media_id')
        .where('character.name', 'like', pattern)
    ),
    eb(
      'media.id',
      'in',
      eb
        .selectFrom('media_series')
        .innerJoin('series', 'series.id', 'media_series.series_id')
        .select('media_series.media_id')
        .where('series.name', 'like', pattern)
    ),
    // The NULL guard matters: without it `artist_id IN (...)` yields NULL for
    // artist-less media, and negating NULL would silently drop those rows from
    // every `-term` search.
    eb.and([
      eb('media.artist_id', 'is not', null),
      eb(
        'media.artist_id',
        'in',
        eb.selectFrom('artist').select('artist.id').where('artist.name', 'like', pattern)
      )
    ]),
    eb('media.name', 'like', pattern)
  ])
}

function compileQueryNode(
  eb: ExpressionBuilder<DB, 'media'>,
  node: QueryNode
): Expression<SqlBool> {
  switch (node.type) {
    case 'term':
      return compileTerm(eb, node.value)
    case 'not':
      return eb.not(compileQueryNode(eb, node.child))
    case 'and':
      return eb.and(node.children.map((child) => compileQueryNode(eb, child)))
    case 'or':
      return eb.or(node.children.map((child) => compileQueryNode(eb, child)))
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inferred Kysely SelectQueryBuilder generic is impractical to spell out
function applyMediaFilters(
  db: Kysely<DB>,
  filters: MediaFilters,
  seriesClosures?: Map<string, string[]>,
  characterClosures?: Map<string, string[]>
) {
  let qb = db.selectFrom('media')

  const rawAst = filters.query?.trim() ? parseSearchQuery(filters.query) : null
  const { node: queryAst, isAiGenerated: aiFromQuery } = extractAiToken(rawAst)
  if (queryAst) {
    qb = qb.where((eb) => compileQueryNode(eb, queryAst))
  }

  const isAiGenerated = filters.isAiGenerated ?? aiFromQuery
  if (isAiGenerated !== undefined) {
    qb = qb.where('media.is_ai_generated', '=', isAiGenerated ? 1 : 0)
  }

  if (filters.artistId) {
    qb = qb.where('media.artist_id', '=', filters.artistId)
  }
  if (filters.sfw !== undefined) {
    qb = qb.where('media.sfw', '=', filters.sfw ? 1 : 0)
  }
  if (filters.type) {
    qb = qb.where('media.type', '=', filters.type)
  }

  qb = applyGroupedFilter(qb, db, 'media_tag', 'tag_id', filters.tagGroups)
  qb = applyClosureGroupedFilter(
    qb,
    db,
    'media_character',
    'character_id',
    filters.characterGroups,
    characterClosures
  )

  if (filters.noCharacter) {
    qb = qb.where('media.id', 'not in', db.selectFrom('media_character').select('media_id'))
  }

  qb = applyClosureGroupedFilter(qb, db, 'media_series', 'series_id', filters.seriesGroups, seriesClosures)

  if (filters.noSeries) {
    qb = qb.where('media.id', 'not in', db.selectFrom('media_series').select('media_id'))
  }

  if (filters.pendingTagging !== undefined) {
    qb = qb.where('media.pending_tagging', '=', filters.pendingTagging ? 1 : 0)
  }

  return qb
}

export function findMediaRows(
  db: Kysely<DB>,
  filters: MediaFilters,
  sorting?: Sorting,
  seriesClosures?: Map<string, string[]>,
  characterClosures?: Map<string, string[]>
): Promise<MediaTable[]> {
  const sortColumn = SORT_COLUMNS[sorting?.prop ?? 'createdAt'] ?? 'created_at'

  return applyMediaFilters(db, filters, seriesClosures, characterClosures)
    .selectAll('media')
    .orderBy(sortColumn, sorting?.desc ? 'desc' : 'asc')
    .limit(filters.limit ?? DEFAULT_LIMIT)
    .offset(filters.offset ?? 0)
    .execute()
}

/** Same ordering/filtering as `findMediaRows`, but every matching id (no limit/offset) - used to
 * work out a media item's previous/next siblings without paying for the full row hydration. */
export function findMediaIds(
  db: Kysely<DB>,
  filters: MediaFilters,
  sorting?: Sorting,
  seriesClosures?: Map<string, string[]>,
  characterClosures?: Map<string, string[]>
): Promise<{ id: string }[]> {
  const sortColumn = SORT_COLUMNS[sorting?.prop ?? 'createdAt'] ?? 'created_at'

  return applyMediaFilters(db, filters, seriesClosures, characterClosures)
    .select('media.id')
    .orderBy(sortColumn, sorting?.desc ? 'desc' : 'asc')
    .execute()
}

export async function countMediaRows(
  db: Kysely<DB>,
  filters: MediaFilters,
  seriesClosures?: Map<string, string[]>,
  characterClosures?: Map<string, string[]>
): Promise<number> {
  const result = await applyMediaFilters(db, filters, seriesClosures, characterClosures)
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow()
  return Number(result.count)
}

export function findMediaRowById(db: Kysely<DB>, id: string): Promise<MediaTable | undefined> {
  return db.selectFrom('media').selectAll().where('id', '=', id).executeTakeFirst()
}

export function findMediaRowByRoute(
  db: Kysely<DB>,
  route: string
): Promise<MediaTable | undefined> {
  return db.selectFrom('media').selectAll().where('route', '=', route).executeTakeFirst()
}

export function findMediaRowByHash(db: Kysely<DB>, hash: string): Promise<MediaTable | undefined> {
  return db.selectFrom('media').selectAll().where('hash', '=', hash).executeTakeFirst()
}

/** Only `id`/`phash` - the near-duplicate scan in checkDuplicate() doesn't need the rest of each row. */
export function listAllMediaHashes(
  db: Kysely<DB>
): Promise<{ id: string; phash: string | null }[]> {
  return db.selectFrom('media').select(['id', 'phash']).where('phash', 'is not', null).execute()
}

export function listMediaRowsMissingHash(db: Kysely<DB>, limit: number): Promise<MediaTable[]> {
  return db.selectFrom('media').selectAll().where('hash', 'is', null).limit(limit).execute()
}

export async function setMediaHash(
  db: Kysely<DB>,
  id: string,
  hash: string | null,
  phash: string | null
): Promise<void> {
  await db.updateTable('media').set({ hash, phash }).where('id', '=', id).execute()
}

export function insertMediaRow(db: Kysely<DB>, media: MediaTable): Promise<MediaTable> {
  return db.insertInto('media').values(media).returningAll().executeTakeFirstOrThrow()
}

export function updateMediaRow(
  db: Kysely<DB>,
  id: string,
  changes: Partial<Omit<MediaTable, 'id'>>
): Promise<MediaTable> {
  return db
    .updateTable('media')
    .set(changes)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function deleteMediaRow(db: Kysely<DB>, id: string): Promise<void> {
  await db.deleteFrom('media').where('id', '=', id).execute()
}

export async function setMediaTags(
  db: Kysely<DB>,
  mediaId: string,
  tagIds: string[]
): Promise<void> {
  await db.deleteFrom('media_tag').where('media_id', '=', mediaId).execute()
  if (tagIds.length) {
    await db
      .insertInto('media_tag')
      .values(tagIds.map((tagId) => ({ media_id: mediaId, tag_id: tagId })))
      .execute()
  }
}

export async function setMediaCharacters(
  db: Kysely<DB>,
  mediaId: string,
  characterIds: string[]
): Promise<void> {
  await db.deleteFrom('media_character').where('media_id', '=', mediaId).execute()
  if (characterIds.length) {
    await db
      .insertInto('media_character')
      .values(characterIds.map((characterId) => ({ media_id: mediaId, character_id: characterId })))
      .execute()
  }
}

export async function setMediaSeries(
  db: Kysely<DB>,
  mediaId: string,
  seriesIds: string[]
): Promise<void> {
  await db.deleteFrom('media_series').where('media_id', '=', mediaId).execute()
  if (seriesIds.length) {
    await db
      .insertInto('media_series')
      .values(seriesIds.map((seriesId) => ({ media_id: mediaId, series_id: seriesId })))
      .execute()
  }
}

export function listMediaRoutes(db: Kysely<DB>): Promise<{ id: string; route: string }[]> {
  return db.selectFrom('media').select(['id', 'route']).execute()
}

/** Adds `name`/`type` to `listMediaRoutes` - used to list *which* files are missing, not just count them. */
export function listMediaRoutesWithMeta(
  db: Kysely<DB>
): Promise<{ id: string; route: string; name: string; type: string }[]> {
  return db.selectFrom('media').select(['id', 'route', 'name', 'type']).execute()
}

// SQLite's default SQLITE_MAX_VARIABLE_NUMBER is 32766 - chunk well under that
// so a single `IN (...)` clause never risks "too many SQL variables".
const ROUTES_EXIST_CHUNK_SIZE = 500

/** Batch existence check for a set of routes - avoids one query per candidate file when browsing a folder. */
export async function routesExist(db: Kysely<DB>, routes: string[]): Promise<Set<string>> {
  if (routes.length === 0) return new Set()

  const found = new Set<string>()
  for (let i = 0; i < routes.length; i += ROUTES_EXIST_CHUNK_SIZE) {
    const chunk = routes.slice(i, i + ROUTES_EXIST_CHUNK_SIZE)
    const rows = await db.selectFrom('media').select('route').where('route', 'in', chunk).execute()
    for (const row of rows) found.add(row.route)
  }
  return found
}

export async function updateMediaRoutes(
  db: Kysely<DB>,
  updates: { id: string; route: string }[]
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    for (const update of updates) {
      await trx
        .updateTable('media')
        .set({ route: update.route })
        .where('id', '=', update.id)
        .execute()
    }
  })
}

export async function findTagsForMediaIds(
  db: Kysely<DB>,
  mediaIds: string[]
): Promise<Map<string, { id: string; name: string; created_at: number }[]>> {
  const map = new Map<string, { id: string; name: string; created_at: number }[]>()
  if (!mediaIds.length) return map

  const rows = await db
    .selectFrom('media_tag')
    .innerJoin('tag', 'tag.id', 'media_tag.tag_id')
    .select([
      'media_tag.media_id as mediaId',
      'tag.id as id',
      'tag.name as name',
      'tag.created_at as created_at'
    ])
    .where('media_tag.media_id', 'in', mediaIds)
    .execute()

  for (const row of rows) {
    const list = map.get(row.mediaId) ?? []
    list.push({ id: row.id, name: row.name, created_at: row.created_at })
    map.set(row.mediaId, list)
  }
  return map
}

export async function findCharactersForMediaIds(
  db: Kysely<DB>,
  mediaIds: string[]
): Promise<Map<string, { id: string; name: string; aliases_json: string; created_at: number }[]>> {
  const map = new Map<
    string,
    { id: string; name: string; aliases_json: string; created_at: number }[]
  >()
  if (!mediaIds.length) return map

  const rows = await db
    .selectFrom('media_character')
    .innerJoin('character', 'character.id', 'media_character.character_id')
    .select([
      'media_character.media_id as mediaId',
      'character.id as id',
      'character.name as name',
      'character.aliases_json as aliases_json',
      'character.created_at as created_at'
    ])
    .where('media_character.media_id', 'in', mediaIds)
    .execute()

  for (const row of rows) {
    const list = map.get(row.mediaId) ?? []
    list.push({
      id: row.id,
      name: row.name,
      aliases_json: row.aliases_json,
      created_at: row.created_at
    })
    map.set(row.mediaId, list)
  }
  return map
}

export async function findSeriesForMediaIds(
  db: Kysely<DB>,
  mediaIds: string[]
): Promise<Map<string, { id: string; name: string; aliases_json: string; created_at: number }[]>> {
  const map = new Map<
    string,
    { id: string; name: string; aliases_json: string; created_at: number }[]
  >()
  if (!mediaIds.length) return map

  const rows = await db
    .selectFrom('media_series')
    .innerJoin('series', 'series.id', 'media_series.series_id')
    .select([
      'media_series.media_id as mediaId',
      'series.id as id',
      'series.name as name',
      'series.aliases_json as aliases_json',
      'series.created_at as created_at'
    ])
    .where('media_series.media_id', 'in', mediaIds)
    .execute()

  for (const row of rows) {
    const list = map.get(row.mediaId) ?? []
    list.push({
      id: row.id,
      name: row.name,
      aliases_json: row.aliases_json,
      created_at: row.created_at
    })
    map.set(row.mediaId, list)
  }
  return map
}

export interface EntityThumbnailRow {
  entityId: string
  route: string
  type: string
}

const ENTITY_THUMBNAIL_JOIN: Record<
  'tag' | 'character' | 'series',
  {
    table: 'media_tag' | 'media_character' | 'media_series'
    column: 'tag_id' | 'character_id' | 'series_id'
  }
> = {
  tag: { table: 'media_tag', column: 'tag_id' },
  character: { table: 'media_character', column: 'character_id' },
  series: { table: 'media_series', column: 'series_id' }
}

/**
 * One SFW media thumbnail per requested entity id, chosen server-side so the
 * caller never has to fetch (let alone hydrate) more than `ids.length` rows
 * to render a grid of small previews. For `character`, prefers a media item
 * where that character is the only one credited (a solo appearance reads as
 * a more useful preview than one cropped out of a group shot) - implemented
 * via a `RANDOM()`-ordered window function partitioned per entity, with a
 * secondary sort key breaking ties toward solo appearances; expressed as raw
 * SQL (via Kysely's `sql` tag) because "top-1-per-group with a per-kind
 * tiebreak" isn't something the fluent query builder expresses cleanly, and
 * the four kinds each need slightly different joins.
 *
 * The `series`/`character` branches match the exact requested ids only. Callers that want a
 * parent to inherit a thumbnail from its descendants must use `findEntityThumbnailsByClosure`
 * instead - see `mediaService.getEntityThumbnails`.
 */
export async function findEntityThumbnails(
  db: Kysely<DB>,
  kind: 'artist' | 'tag' | 'character' | 'series',
  ids: string[]
): Promise<EntityThumbnailRow[]> {
  if (ids.length === 0) return []

  if (kind === 'artist') {
    const result = await sql<EntityThumbnailRow>`
      SELECT entity_id as entityId, route, type FROM (
        SELECT
          media.artist_id AS entity_id,
          media.route AS route,
          media.type AS type,
          ROW_NUMBER() OVER (PARTITION BY media.artist_id ORDER BY RANDOM()) AS rn
        FROM media
        WHERE media.artist_id IN (${sql.join(ids)}) AND media.sfw = 1
      ) WHERE rn = 1
    `.execute(db)
    return result.rows
  }

  const { table, column } = ENTITY_THUMBNAIL_JOIN[kind]
  const soloTiebreak =
    kind === 'character' ? sql`(CASE WHEN char_count.cnt = 1 THEN 0 ELSE 1 END), ` : sql``
  const soloJoin =
    kind === 'character'
      ? sql`LEFT JOIN (SELECT media_id, COUNT(*) AS cnt FROM media_character GROUP BY media_id) char_count ON char_count.media_id = media.id`
      : sql``

  const result = await sql<EntityThumbnailRow>`
    SELECT entity_id as entityId, route, type FROM (
      SELECT
        j.${sql.ref(column)} AS entity_id,
        media.route AS route,
        media.type AS type,
        ROW_NUMBER() OVER (PARTITION BY j.${sql.ref(column)} ORDER BY ${soloTiebreak}RANDOM()) AS rn
      FROM ${sql.table(table)} j
      JOIN media ON media.id = j.media_id
      ${soloJoin}
      WHERE j.${sql.ref(column)} IN (${sql.join(ids)}) AND media.sfw = 1
    ) WHERE rn = 1
  `.execute(db)
  return result.rows
}

/** An id actually linked to media, paired with the requested ancestor it should count towards. */
export interface EntityClosurePair {
  descendantId: string
  ancestorId: string
}

/**
 * Thumbnails that honour a hierarchy: one SFW thumbnail per *requested ancestor*, drawn from
 * media linked to any id in that ancestor's closure (itself plus every descendant). A parent
 * whose media all live under its children still gets a preview, matching the rolled-up counts
 * the Manage list shows next to it. Used for both series and characters.
 *
 * `media_series`/`media_character` only store exact links, so the closure has to come from the
 * caller: the (descendant, ancestor) pairs are inlined as a derived table and the window function
 * partitions by `ancestor_id` rather than by the raw join column. The pairs go in as a `WITH
 * closure(descendant_id, ancestor_id) AS (VALUES ...)` CTE - the CTE's column list is what names
 * the otherwise anonymous `VALUES` columns so the join below can reference them. A chain of
 * `SELECT ... UNION ALL` would name its columns too, but it is a compound SELECT and so capped at
 * `SQLITE_MAX_COMPOUND_SELECT` (500, hardcoded in better-sqlite3's build): any library with more
 * than ~500 closure pairs would fail outright. A `VALUES` list carries no such cap, leaving only
 * the far roomier parameter limit (32766 host params, i.e. ~16k pairs).
 */
export async function findEntityThumbnailsByClosure(
  db: Kysely<DB>,
  kind: 'series' | 'character',
  pairs: EntityClosurePair[]
): Promise<EntityThumbnailRow[]> {
  // Also keeps the `VALUES` list below from degenerating into invalid SQL,
  // since it needs at least one row.
  if (pairs.length === 0) return []

  const { table, column } = ENTITY_THUMBNAIL_JOIN[kind]
  const pairRows = sql.join(pairs.map((pair) => sql`(${pair.descendantId}, ${pair.ancestorId})`))

  const result = await sql<EntityThumbnailRow>`
    WITH closure(descendant_id, ancestor_id) AS (VALUES ${pairRows})
    SELECT entity_id as entityId, route, type FROM (
      SELECT
        closure.ancestor_id AS entity_id,
        media.route AS route,
        media.type AS type,
        ROW_NUMBER() OVER (PARTITION BY closure.ancestor_id ORDER BY RANDOM()) AS rn
      FROM closure
      JOIN ${sql.table(table)} j ON j.${sql.ref(column)} = closure.descendant_id
      JOIN media ON media.id = j.media_id
      WHERE media.sfw = 1
    ) WHERE rn = 1
  `.execute(db)
  return result.rows
}
