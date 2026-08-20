import { danbooruFetch } from './danbooruHttp'

const REQUEST_TIMEOUT_MS = 8000

/**
 * Validates a username/API key pair against Danbooru and resolves the
 * numeric user id danbooruRequestHeaders() needs for the User-Agent (the
 * account id, not the username, is what Danbooru's anti-bot rule expects -
 * see the DANBOORU_USER_AGENT/danbooruRequestHeaders comment history).
 * Called once when the user saves credentials in Settings, not on every
 * request - danbooruSettings caches the resolved id after that.
 */
export async function resolveDanbooruUserId(username: string, apiKey: string): Promise<number> {
  const url = new URL('https://danbooru.donmai.us/profile.json')
  url.searchParams.set('login', username)
  url.searchParams.set('api_key', apiKey)

  let res: Response
  try {
    res = await danbooruFetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  } catch {
    throw new Error('Could not reach Danbooru. Check your internet connection.')
  }

  if (!res.ok) {
    throw new Error('Danbooru rejected that username/API key.')
  }

  const body = (await res.json()) as { id?: unknown }
  if (typeof body.id !== 'number') {
    throw new Error('Unexpected response from Danbooru.')
  }
  return body.id
}
