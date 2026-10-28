import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '' } }))

const { aggregateStorage } = await import('./storage.service')

const media = (
  id: string,
  route: string,
  file_size: number | null,
  extra: Partial<{ pending_tagging: number; artist_id: string | null; type: string }> = {}
): {
  id: string
  route: string
  file_size: number | null
  pending_tagging: number
  artist_id: string | null
  type: string
} => ({ id, route, file_size, pending_tagging: 0, artist_id: null, type: 'image', ...extra })

describe('aggregateStorage', () => {
  it('adds the library up by folder, entity (through the hierarchy) and artist, Pending apart', () => {
    const overview = aggregateStorage({
      media: [
        media('a', 'Genshin\\Furina\\a.png', 100, { artist_id: 'x' }),
        media('b', 'Genshin/b.png', 50, { artist_id: 'x', type: 'video' }),
        media('c', 'D:\\Elsewhere\\c.png', 20, { type: 'gif' }),
        media('d', 'Genshin\\d.png', null),
        media('p', 'Genshin\\p.png', 70, { pending_tagging: 1 })
      ],
      seriesLinks: [
        { media_id: 'a', entity_id: 'genshin-sub' },
        { media_id: 'a', entity_id: 'genshin' },
        { media_id: 'b', entity_id: 'genshin' },
        { media_id: 'p', entity_id: 'genshin' }
      ],
      characterLinks: [],
      series: [
        { id: 'genshin', name: 'Genshin', parent_id: null },
        { id: 'genshin-sub', name: 'Genshin 2', parent_id: 'genshin' }
      ],
      characters: [],
      artists: [{ id: 'x', name: 'Artist', parent_id: null }],
      tagLinks: [
        { media_id: 'a', entity_id: 'big' },
        { media_id: 'c', entity_id: 'big' },
        { media_id: 'p', entity_id: 'big' }
      ],
      tags: [{ id: 'big', name: 'Big', parent_id: null }]
    })

    expect(overview.library).toEqual({
      bytes: 170,
      count: 4,
      unmeasured: 1,
      byType: {
        image: { bytes: 100, count: 2 },
        gif: { bytes: 20, count: 1 },
        video: { bytes: 50, count: 1 }
      }
    })
    expect(overview.pending).toEqual({ bytes: 70, count: 1 })
    expect(overview.folders).toEqual([
      { path: '', bytes: 150, count: 3 },
      { path: 'Genshin', bytes: 150, count: 3 },
      { path: 'Genshin\\Furina', bytes: 100, count: 1 },
      { path: 'D:\\Elsewhere', bytes: 20, count: 1 }
    ])
    expect(overview.files.map((file) => [file.folder, file.name, file.bytes])).toEqual([
      ['Genshin\\Furina', 'a.png', 100],
      ['Genshin', 'b.png', 50],
      ['D:\\Elsewhere', 'c.png', 20],
      ['Genshin', 'd.png', 0]
    ])
    // "a" counts once under Genshin although it's linked to it and to its subseries.
    expect(overview.series).toEqual([
      { id: 'genshin', name: 'Genshin', bytes: 150, count: 2 },
      { id: 'genshin-sub', name: 'Genshin 2', bytes: 100, count: 1 }
    ])
    expect(overview.artists).toEqual([{ id: 'x', name: 'Artist', bytes: 150, count: 2 }])
    expect(overview.tags).toEqual([{ id: 'big', name: 'Big', bytes: 120, count: 2 }])
  })
})
