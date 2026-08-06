import { randomUUID } from 'crypto'
import { getDb } from '../database/connection'
import * as artistRepo from '../database/repositories/artist.repository'
import type { ArtistInput, ArtistModel, SocialLinkInput } from '@shared/models'
import type { ArtistSocialLinkTable, ArtistTable } from '../database/schema'

function toModel(row: ArtistTable, links: ArtistSocialLinkTable[], mediaCount?: number): ArtistModel {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    socials: links.map((link) => ({
      id: link.id,
      name: link.name,
      url: link.url,
      icon: link.icon ?? undefined
    })),
    mediaCount
  }
}

export const artistService = {
  async getAllArtists(): Promise<ArtistModel[]> {
    const db = getDb()
    const [rows, counts] = await Promise.all([
      artistRepo.findAllArtists(db),
      artistRepo.countMediaPerArtist(db)
    ])
    const links = await artistRepo.findSocialLinksForArtistIds(
      db,
      rows.map((row) => row.id)
    )
    return rows.map((row) =>
      toModel(
        row,
        links.filter((link) => link.artist_id === row.id),
        counts[row.id] ?? 0
      )
    )
  },

  async getArtistById(id: string): Promise<ArtistModel | null> {
    const db = getDb()
    const row = await artistRepo.findArtistById(db, id)
    if (!row) return null
    const links = await artistRepo.findSocialLinksForArtistIds(db, [id])
    return toModel(row, links)
  },

  async createArtist(input: ArtistInput): Promise<ArtistModel> {
    const row = await artistRepo.insertArtist(getDb(), {
      id: randomUUID(),
      name: input.name,
      created_at: Date.now()
    })
    return toModel(row, [])
  },

  async updateArtist(id: string, input: ArtistInput): Promise<ArtistModel> {
    const db = getDb()
    const row = await artistRepo.updateArtist(db, id, { name: input.name })
    const links = await artistRepo.findSocialLinksForArtistIds(db, [id])
    return toModel(row, links)
  },

  async deleteArtist(id: string): Promise<void> {
    await artistRepo.deleteArtist(getDb(), id)
  },

  async addSocialLink(artistId: string, socialLink: SocialLinkInput): Promise<ArtistModel> {
    const db = getDb()
    const artist = await artistRepo.findArtistById(db, artistId)
    if (!artist) throw new Error('Artist not found')

    const existing = await artistRepo.findSocialLinkByArtistAndUrl(db, artistId, socialLink.url)
    if (!existing) {
      await artistRepo.insertSocialLink(db, {
        id: randomUUID(),
        artist_id: artistId,
        name: socialLink.name,
        url: socialLink.url,
        icon: socialLink.icon ?? null,
        position: 0
      })
    }

    const links = await artistRepo.findSocialLinksForArtistIds(db, [artistId])
    return toModel(artist, links)
  },

  async removeSocialLink(artistId: string, socialLinkId: string): Promise<ArtistModel> {
    const db = getDb()
    const artist = await artistRepo.findArtistById(db, artistId)
    if (!artist) throw new Error('Artist not found')

    await artistRepo.deleteSocialLink(db, socialLinkId)

    const links = await artistRepo.findSocialLinksForArtistIds(db, [artistId])
    return toModel(artist, links)
  }
}
