import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fsPromises, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir
  }
}))

const { readDanbooruCredentials, writeDanbooruCredentials, resetDanbooruCredentialsCache } =
  await import('./danbooruSettings')

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'danbooru-settings-'))
  resetDanbooruCredentialsCache()
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
})

describe('danbooruSettings', () => {
  it('returns undefined when nothing is stored', () => {
    expect(readDanbooruCredentials()).toBeUndefined()
  })

  it('persists and reloads saved credentials', () => {
    writeDanbooruCredentials({ username: 'arnau', apiKey: 'abc123', userId: 42 })
    expect(readDanbooruCredentials()).toEqual({ username: 'arnau', apiKey: 'abc123', userId: 42 })
  })

  it('treats undefined as cleared', () => {
    writeDanbooruCredentials({ username: 'arnau', apiKey: 'abc123', userId: 42 })
    writeDanbooruCredentials(undefined)
    expect(readDanbooruCredentials()).toBeUndefined()
  })

  it('returns undefined when the stored file is missing the numeric userId', () => {
    writeFileSync(
      join(userDataDir, 'danbooru-settings.json'),
      JSON.stringify({ username: 'arnau', apiKey: 'abc123' }),
      'utf-8'
    )
    expect(readDanbooruCredentials()).toBeUndefined()
  })

  it('returns undefined when the stored file is corrupted JSON', () => {
    writeFileSync(join(userDataDir, 'danbooru-settings.json'), 'not-json', 'utf-8')
    expect(readDanbooruCredentials()).toBeUndefined()
  })
})
