import type { Kysely } from 'kysely'
import type { CharacterTable, DB } from '../schema'

export function findAllCharacters(db: Kysely<DB>): Promise<CharacterTable[]> {
  return db.selectFrom('character').selectAll().orderBy('name', 'asc').execute()
}

export function findCharacterById(db: Kysely<DB>, id: string): Promise<CharacterTable | undefined> {
  return db.selectFrom('character').selectAll().where('id', '=', id).executeTakeFirst()
}

export function findCharactersByIds(db: Kysely<DB>, ids: string[]): Promise<CharacterTable[]> {
  if (!ids.length) return Promise.resolve([])
  return db.selectFrom('character').selectAll().where('id', 'in', ids).execute()
}

export async function findCharacterHierarchy(
  db: Kysely<DB>
): Promise<{ id: string; parentId: string | null }[]> {
  const rows = await db.selectFrom('character').select(['id', 'parent_id']).execute()
  return rows.map((row) => ({ id: row.id, parentId: row.parent_id }))
}

export function insertCharacter(
  db: Kysely<DB>,
  character: CharacterTable
): Promise<CharacterTable> {
  return db.insertInto('character').values(character).returningAll().executeTakeFirstOrThrow()
}

export function updateCharacter(
  db: Kysely<DB>,
  id: string,
  changes: Partial<Omit<CharacterTable, 'id'>>
): Promise<CharacterTable> {
  return db
    .updateTable('character')
    .set(changes)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function deleteCharacter(db: Kysely<DB>, id: string): Promise<void> {
  await db.deleteFrom('character').where('id', '=', id).execute()
}

/** Direct media_character link count per character, 0 for characters with none. */
export async function countMediaPerCharacter(db: Kysely<DB>): Promise<Record<string, number>> {
  const rows = await db
    .selectFrom('character')
    .leftJoin('media_character', 'media_character.character_id', 'character.id')
    .select(['character.id as id'])
    .select((eb) => eb.fn.count('media_character.media_id').as('count'))
    .groupBy('character.id')
    .execute()
  return Object.fromEntries(rows.map((row) => [row.id, Number(row.count)]))
}

export async function setCharacterSeries(
  db: Kysely<DB>,
  characterId: string,
  seriesIds: string[]
): Promise<void> {
  await db.deleteFrom('character_series').where('character_id', '=', characterId).execute()
  if (seriesIds.length) {
    await db
      .insertInto('character_series')
      .values(seriesIds.map((seriesId) => ({ character_id: characterId, series_id: seriesId })))
      .execute()
  }
}

export async function findSeriesForCharacterIds(
  db: Kysely<DB>,
  characterIds: string[]
): Promise<Map<string, { id: string; name: string; aliases_json: string; created_at: number }[]>> {
  const map = new Map<
    string,
    { id: string; name: string; aliases_json: string; created_at: number }[]
  >()
  if (!characterIds.length) return map

  const rows = await db
    .selectFrom('character_series')
    .innerJoin('series', 'series.id', 'character_series.series_id')
    .select([
      'character_series.character_id as characterId',
      'series.id as id',
      'series.name as name',
      'series.aliases_json as aliases_json',
      'series.created_at as created_at'
    ])
    .where('character_series.character_id', 'in', characterIds)
    .execute()

  for (const row of rows) {
    const list = map.get(row.characterId) ?? []
    list.push({
      id: row.id,
      name: row.name,
      aliases_json: row.aliases_json,
      created_at: row.created_at
    })
    map.set(row.characterId, list)
  }
  return map
}
