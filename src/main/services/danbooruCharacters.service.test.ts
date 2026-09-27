import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { initTestDbSingleton } from '../database/testHelpers'

let userDataDir = ''

vi.stubGlobal('fetch', vi.fn())
vi.mock('electron', () => ({
  app: { getPath: () => userDataDir, getVersion: () => '1.0.0' }
}))

const { resolveCharacterTags } = await import('./danbooruCharacters.service')
const { writeDanbooruCredentials, resetDanbooruCredentialsCache } = await import(
  './danbooruSettings'
)
const { resetDanbooruRateLimiterForTests } = await import('./danbooruHttp')

let cleanup: () => Promise<void>

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) } as Response
}

/** A tiny fake Danbooru: implications and related copyrights for the Xenoblade example. */
function fakeDanbooru(url: URL): Response {
  if (url.pathname === '/tag_implications.json') {
    const asked = url.searchParams.get('search[antecedent_name_comma]')!.split(',')
    const all = [
      ['pyra_(pro_swimmer)_(xenoblade)', 'pyra_(xenoblade)'],
      ['xenoblade_chronicles_2', 'xenoblade_chronicles_(series)']
    ]
    return jsonResponse(
      all
        .filter(([antecedent]) => asked.includes(antecedent))
        .map(([antecedent_name, consequent_name]) => ({ antecedent_name, consequent_name }))
    )
  }
  if (url.pathname === '/related_tag.json') {
    return jsonResponse({
      related_tags: [
        { tag: { name: 'xenoblade_chronicles_(series)' }, frequency: 1 },
        { tag: { name: 'xenoblade_chronicles_2' }, frequency: 1 },
        { tag: { name: 'super_smash_bros.' }, frequency: 0.09 }
      ]
    })
  }
  throw new Error(`unexpected ${url}`)
}

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'danbooru-characters-'))
  resetDanbooruCredentialsCache()
  writeDanbooruCredentials({ username: 'arnau', apiKey: 'abc123', userId: 42 })
  resetDanbooruRateLimiterForTests()
  cleanup = (await initTestDbSingleton()).cleanup
  vi.mocked(fetch).mockReset()
  vi.mocked(fetch).mockImplementation(async (input) => fakeDanbooru(new URL(String(input))))
})

afterEach(async () => {
  await cleanup()
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
})

describe('resolveCharacterTags', () => {
  it('finds the base character and the most specific series, then answers from the cache', async () => {
    const expected = [
      {
        tag: 'pyra_(pro_swimmer)_(xenoblade)',
        parentTag: 'pyra_(xenoblade)',
        series: ['xenoblade_chronicles_2']
      }
    ]
    expect(await resolveCharacterTags(['Pyra (Pro Swimmer) (Xenoblade)'])).toEqual(expected)
    // Implications for the tag, related copyrights for its base, implications among those.
    expect(fetch).toHaveBeenCalledTimes(3)

    vi.mocked(fetch).mockClear()
    expect(await resolveCharacterTags(['pyra (pro swimmer) (xenoblade)'])).toEqual(expected)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('asks nothing without a Danbooru account, and caches nothing when Danbooru fails', async () => {
    resetDanbooruCredentialsCache()
    writeDanbooruCredentials(undefined)
    expect(await resolveCharacterTags(['pyra (xenoblade)'])).toEqual([])
    expect(fetch).not.toHaveBeenCalled()

    writeDanbooruCredentials({ username: 'arnau', apiKey: 'abc123', userId: 42 })
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    expect(await resolveCharacterTags(['pyra (xenoblade)'])).toEqual([])
    expect(await resolveCharacterTags(['pyra (xenoblade)'])).toEqual([
      { tag: 'pyra_(xenoblade)', parentTag: null, series: ['xenoblade_chronicles_2'] }
    ])
  })
})
