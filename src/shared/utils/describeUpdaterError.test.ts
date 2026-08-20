import { describe, expect, it } from 'vitest'
import { describeUpdaterError } from './describeUpdaterError'

describe('describeUpdaterError', () => {
  it('gives a specific message for a 404 (e.g. an unpublished/draft release)', () => {
    expect(
      describeUpdaterError('Cannot find latest.yml in the latest release artifacts: HttpError: 404')
    ).toBe("Could not find this update's files - the release may not be fully published yet.")
  })

  it('gives a specific message for a network failure', () => {
    expect(describeUpdaterError('net::ERR_INTERNET_DISCONNECTED')).toBe(
      'Could not reach GitHub. Check your internet connection.'
    )
    expect(describeUpdaterError('getaddrinfo ENOTFOUND github.com')).toBe(
      'Could not reach GitHub. Check your internet connection.'
    )
  })

  it('falls back to a generic message for anything else, never the raw text', () => {
    const raw =
      'HttpError: 500 "method: GET url: https://..." Headers: { "content-length": "29" } at createHttpError (C:\\huge\\stack\\trace.js:21:12)'
    const result = describeUpdaterError(raw)

    expect(result).toBe('Update check failed. Try again later.')
    expect(result).not.toContain('Headers')
    expect(result).not.toContain('.js:')
  })
})
