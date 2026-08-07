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

const { readSauceNaoApiKey, writeSauceNaoApiKey, resetSauceNaoApiKeyCache } = await import(
  './sauceNaoSettings'
)

beforeEach(async () => {
  userDataDir = await fsPromises.mkdtemp(join(tmpdir(), 'sauce-nao-settings-'))
  resetSauceNaoApiKeyCache()
})

afterEach(async () => {
  await fsPromises.rm(userDataDir, { recursive: true, force: true })
})

describe('sauceNaoSettings', () => {
  it('returns undefined when nothing is stored', () => {
    expect(readSauceNaoApiKey()).toBeUndefined()
  })

  it('persists and reloads a saved key', () => {
    writeSauceNaoApiKey('abc123')
    expect(readSauceNaoApiKey()).toBe('abc123')
  })

  it('trims whitespace around the key', () => {
    writeSauceNaoApiKey('  abc123  ')
    expect(readSauceNaoApiKey()).toBe('abc123')
  })

  it('treats an empty/whitespace-only key as cleared', () => {
    writeSauceNaoApiKey('abc123')
    writeSauceNaoApiKey('   ')
    expect(readSauceNaoApiKey()).toBeUndefined()
  })

  it('treats undefined as cleared', () => {
    writeSauceNaoApiKey('abc123')
    writeSauceNaoApiKey(undefined)
    expect(readSauceNaoApiKey()).toBeUndefined()
  })

  it('returns undefined when the stored file is corrupted JSON', () => {
    writeFileSync(join(userDataDir, 'sauce-nao-settings.json'), 'not-json', 'utf-8')
    expect(readSauceNaoApiKey()).toBeUndefined()
  })
})
