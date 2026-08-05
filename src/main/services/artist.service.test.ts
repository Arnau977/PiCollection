import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initTestDbSingleton } from '../database/testHelpers'
import { artistService } from './artist.service'

let cleanup: () => Promise<void>

beforeEach(async () => {
  const testDb = await initTestDbSingleton()
  cleanup = testDb.cleanup
})

afterEach(async () => {
  await cleanup()
})

describe('artistService', () => {
  it('creates an artist with no social links', async () => {
    const artist = await artistService.createArtist({ name: 'Jane' })
    expect(artist.name).toBe('Jane')
    expect(artist.socials).toEqual([])
  })

  it('adds a social link to an artist', async () => {
    const artist = await artistService.createArtist({ name: 'Jane' })
    const updated = await artistService.addSocialLink(artist.id, {
      name: 'Twitter',
      url: 'https://twitter.com/jane'
    })
    expect(updated.socials).toHaveLength(1)
    expect(updated.socials?.[0].url).toBe('https://twitter.com/jane')
  })

  it('does not add a duplicate social link with the same url', async () => {
    const artist = await artistService.createArtist({ name: 'Jane' })
    await artistService.addSocialLink(artist.id, {
      name: 'Twitter',
      url: 'https://twitter.com/jane'
    })
    const updated = await artistService.addSocialLink(artist.id, {
      name: 'Twitter (renamed)',
      url: 'https://twitter.com/jane'
    })
    expect(updated.socials).toHaveLength(1)
  })

  it('removes a social link by id', async () => {
    const artist = await artistService.createArtist({ name: 'Jane' })
    const withLink = await artistService.addSocialLink(artist.id, {
      name: 'Twitter',
      url: 'https://twitter.com/jane'
    })
    const linkId = withLink.socials?.[0].id as string

    const updated = await artistService.removeSocialLink(artist.id, linkId)
    expect(updated.socials).toEqual([])
  })

  it('throws when adding a social link to a nonexistent artist', async () => {
    await expect(
      artistService.addSocialLink('nonexistent-id', { name: 'x', url: 'https://x.test' })
    ).rejects.toThrow()
  })

  it('deletes an artist', async () => {
    const artist = await artistService.createArtist({ name: 'Jane' })
    await artistService.deleteArtist(artist.id)
    const all = await artistService.getAllArtists()
    expect(all).toEqual([])
  })

  it('sets createdAt on a newly created artist', async () => {
    const before = Date.now()
    const artist = await artistService.createArtist({ name: 'Jane' })
    expect(artist.createdAt).toBeGreaterThanOrEqual(before)
  })
})
