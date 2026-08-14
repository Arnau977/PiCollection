import { describe, expect, it } from 'vitest'
import { pickBestMatch, type SauceNaoResponse } from './sauceNao.parse'

function resultWith(overrides: {
  similarity?: string | number
  indexName?: string
  characters?: string
  material?: string
  creator?: string | string[]
  memberName?: string
  authorName?: string
  extUrls?: string[]
  title?: string
  memberId?: string | number
  twitterUserHandle?: string
}): NonNullable<SauceNaoResponse['results']>[number] {
  return {
    header: {
      similarity: overrides.similarity ?? 90,
      index_name: overrides.indexName ?? 'Danbooru'
    },
    data: {
      characters: overrides.characters,
      material: overrides.material,
      creator: overrides.creator,
      member_name: overrides.memberName,
      author_name: overrides.authorName,
      ext_urls: overrides.extUrls,
      title: overrides.title,
      member_id: overrides.memberId,
      twitter_user_handle: overrides.twitterUserHandle
    }
  }
}

describe('pickBestMatch', () => {
  it('returns null when nothing meets the similarity threshold', () => {
    const response: SauceNaoResponse = { results: [resultWith({ similarity: 40 })] }
    expect(pickBestMatch(response).match).toBeNull()
  })

  it('picks the highest-similarity result among equally-qualified candidates', () => {
    const response: SauceNaoResponse = {
      results: [
        resultWith({ similarity: 70, characters: 'Alice', material: 'Wonderland' }),
        resultWith({ similarity: 95, characters: 'Bob', material: 'Wonderland' })
      ]
    }
    expect(pickBestMatch(response).match?.characters).toEqual([{ name: 'Bob' }])
  })

  it('prefers a lower-similarity result with booru metadata over a higher-similarity one without', () => {
    const response: SauceNaoResponse = {
      results: [
        resultWith({ similarity: 92, indexName: 'Pixiv', memberName: 'some_artist' }),
        resultWith({
          similarity: 85,
          indexName: 'Danbooru',
          characters: 'Ishtar',
          material: 'Fate/Grand Order',
          creator: 'real_artist'
        })
      ]
    }
    const { match } = pickBestMatch(response)
    expect(match?.similarity).toBe(85)
    expect(match?.indexName).toBe('Danbooru')
    expect(match?.characters).toEqual([{ name: 'Ishtar' }])
  })

  it('falls back to the top result and its member_name when nothing has metadata', () => {
    const response: SauceNaoResponse = {
      results: [resultWith({ similarity: 91, indexName: 'Pixiv', memberName: 'some_artist' })]
    }
    const { match } = pickBestMatch(response)
    expect(match?.similarity).toBe(91)
    expect(match?.artist).toEqual({ name: 'some artist' })
  })

  it('parses a similarity given as a string or a number', () => {
    expect(pickBestMatch({ results: [resultWith({ similarity: '87.3' })] }).match?.similarity).toBe(
      87.3
    )
    expect(pickBestMatch({ results: [resultWith({ similarity: 87.3 })] }).match?.similarity).toBe(
      87.3
    )
  })

  it('treats an unparseable similarity as 0 and filters it out', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately malformed input
    expect(pickBestMatch({ results: [resultWith({ similarity: 'abc' as any })] }).match).toBeNull()
  })

  it('accepts creator as an array', () => {
    const { match } = pickBestMatch({ results: [resultWith({ creator: ['artist_one'] })] })
    expect(match?.artist).toEqual({ name: 'artist one' })
  })

  it('falls back from creator to member_name to author_name to null', () => {
    expect(
      pickBestMatch({ results: [resultWith({ memberName: 'member' })] }).match?.artist
    ).toEqual({ name: 'member' })
    expect(
      pickBestMatch({ results: [resultWith({ authorName: 'author' })] }).match?.artist
    ).toEqual({ name: 'author' })
    expect(pickBestMatch({ results: [resultWith({})] }).match?.artist).toBeNull()
  })

  it('reads the remaining-search counters from the header, defaulting to 0', () => {
    expect(
      pickBestMatch({
        header: { short_remaining: 5, long_remaining: 99 },
        results: [resultWith({})]
      }).remaining
    ).toEqual({ short: 5, long: 99 })
    expect(pickBestMatch({ results: [resultWith({})] }).remaining).toEqual({ short: 0, long: 0 })
  })

  it('collects distinct character qualifiers into seriesHints', () => {
    const { match } = pickBestMatch({
      results: [
        resultWith({
          characters: 'Ishtar (Fate), Ereshkigal (Fate), Reimu (Touhou)',
          material: 'Fate/Grand Order'
        })
      ]
    })
    // "Fate" is kept even though `material` is "Fate/Grand Order" - qualifiers
    // are often abbreviated and only an exact match gets deduped (see below).
    expect(match?.seriesHints).toEqual([{ name: 'Fate' }, { name: 'Touhou' }])
  })

  it('drops a qualifier that exactly matches an already-known series', () => {
    const { match } = pickBestMatch({
      results: [resultWith({ characters: 'Reimu (Touhou)', material: 'Touhou' })]
    })
    expect(match?.seriesHints).toEqual([])
  })

  it('handles a missing results array without throwing', () => {
    expect(pickBestMatch({}).match).toBeNull()
  })

  it('handles a result with no data field without throwing', () => {
    expect(pickBestMatch({ results: [{ header: { similarity: 90 } }] }).match).not.toBeNull()
  })

  it('handles empty ext_urls without throwing', () => {
    const { match } = pickBestMatch({ results: [resultWith({ extUrls: [] })] })
    expect(match?.sourceUrl).toBeUndefined()
  })

  it('derives a Pixiv profile URL from member_id alongside member_name', () => {
    const { match } = pickBestMatch({
      results: [resultWith({ memberName: 'some_artist', memberId: 12345 })]
    })
    expect(match?.artist).toEqual({
      name: 'some artist',
      socialUrl: 'https://www.pixiv.net/en/users/12345',
      socialLabel: 'Pixiv'
    })
  })

  it('derives a Twitter profile URL from twitter_user_handle alongside author_name', () => {
    const { match } = pickBestMatch({
      results: [resultWith({ authorName: 'some_author', twitterUserHandle: 'some_handle' })]
    })
    expect(match?.artist).toEqual({
      name: 'some author',
      socialUrl: 'https://twitter.com/some_handle',
      socialLabel: 'Twitter'
    })
  })

  it('does not attach a social link to a booru creator tag', () => {
    const { match } = pickBestMatch({
      results: [
        resultWith({
          creator: 'real_artist',
          memberName: 'unrelated_pixiv_name',
          memberId: 999
        })
      ]
    })
    expect(match?.artist).toEqual({ name: 'real artist' })
  })

  it('omits socialUrl/socialLabel when neither member_id nor twitter_user_handle is present', () => {
    const { match } = pickBestMatch({ results: [resultWith({ memberName: 'plain_artist' })] })
    expect(match?.artist).toEqual({ name: 'plain artist' })
  })
})
