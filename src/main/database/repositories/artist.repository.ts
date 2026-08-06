import type { Kysely } from 'kysely'
import type { ArtistSocialLinkTable, ArtistTable, DB } from '../schema'

export function findAllArtists(db: Kysely<DB>): Promise<ArtistTable[]> {
  return db.selectFrom('artist').selectAll().orderBy('name', 'asc').execute()
}

export function findArtistById(db: Kysely<DB>, id: string): Promise<ArtistTable | undefined> {
  return db.selectFrom('artist').selectAll().where('id', '=', id).executeTakeFirst()
}

export function findArtistsByIds(db: Kysely<DB>, ids: string[]): Promise<ArtistTable[]> {
  if (!ids.length) return Promise.resolve([])
  return db.selectFrom('artist').selectAll().where('id', 'in', ids).execute()
}

export function insertArtist(db: Kysely<DB>, artist: ArtistTable): Promise<ArtistTable> {
  return db.insertInto('artist').values(artist).returningAll().executeTakeFirstOrThrow()
}

export function updateArtist(
  db: Kysely<DB>,
  id: string,
  changes: Partial<Omit<ArtistTable, 'id'>>
): Promise<ArtistTable> {
  return db
    .updateTable('artist')
    .set(changes)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function deleteArtist(db: Kysely<DB>, id: string): Promise<void> {
  await db.deleteFrom('artist').where('id', '=', id).execute()
}

/** Media linked per artist (direct media.artist_id FK), 0 for artists with none. */
export async function countMediaPerArtist(db: Kysely<DB>): Promise<Record<string, number>> {
  const rows = await db
    .selectFrom('artist')
    .leftJoin('media', 'media.artist_id', 'artist.id')
    .select(['artist.id as id'])
    .select((eb) => eb.fn.count('media.id').as('count'))
    .groupBy('artist.id')
    .execute()
  return Object.fromEntries(rows.map((row) => [row.id, Number(row.count)]))
}

export function findSocialLinksForArtistIds(
  db: Kysely<DB>,
  artistIds: string[]
): Promise<ArtistSocialLinkTable[]> {
  if (!artistIds.length) return Promise.resolve([])
  return db
    .selectFrom('artist_social_link')
    .selectAll()
    .where('artist_id', 'in', artistIds)
    .orderBy('position', 'asc')
    .execute()
}

export function insertSocialLink(
  db: Kysely<DB>,
  link: ArtistSocialLinkTable
): Promise<ArtistSocialLinkTable> {
  return db.insertInto('artist_social_link').values(link).returningAll().executeTakeFirstOrThrow()
}

export async function deleteSocialLink(db: Kysely<DB>, id: string): Promise<void> {
  await db.deleteFrom('artist_social_link').where('id', '=', id).execute()
}

export function findSocialLinkByArtistAndUrl(
  db: Kysely<DB>,
  artistId: string,
  url: string
): Promise<ArtistSocialLinkTable | undefined> {
  return db
    .selectFrom('artist_social_link')
    .selectAll()
    .where('artist_id', '=', artistId)
    .where('url', '=', url)
    .executeTakeFirst()
}
