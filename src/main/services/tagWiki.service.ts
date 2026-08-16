import { getDb } from '../database/connection'
import * as tagWikiRepo from '../database/repositories/tagWiki.repository'
import type { TagWikiEntry } from '@shared/models'
import { DANBOORU_USER_AGENT } from './danbooruHttp'

const REQUEST_TIMEOUT_MS = 8000

function toModel(tagName: string, body: string, otherNamesJson: string): TagWikiEntry {
  return { tagName, body, otherNames: JSON.parse(otherNamesJson) }
}

export async function lookupTagWiki(rawTagName: string): Promise<TagWikiEntry | null> {
  const tagName = rawTagName.trim().toLowerCase()
  const db = getDb()

  const cached = await tagWikiRepo.findCachedTagWiki(db, tagName)
  if (cached) return toModel(cached.tag_name, cached.body, cached.other_names_json)

  const url = new URL('https://danbooru.donmai.us/wiki_pages.json')
  url.searchParams.set('search[title]', tagName)

  let res: Response
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'User-Agent': DANBOORU_USER_AGENT }
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('Danbooru took too long to respond. Try again.')
    }
    throw new Error('Could not reach Danbooru. Check your internet connection.')
  }

  if (!res.ok) {
    throw new Error(`Danbooru returned an error (${res.status}).`)
  }

  let body: unknown
  try {
    body = JSON.parse(await res.text())
  } catch {
    throw new Error('Unexpected response from Danbooru.')
  }

  if (!Array.isArray(body) || body.length === 0) return null

  const entry = body[0] as { title?: unknown; body?: unknown; other_names?: unknown }
  if (typeof entry.body !== 'string') return null

  const otherNames = Array.isArray(entry.other_names)
    ? entry.other_names.filter((n): n is string => typeof n === 'string')
    : []

  await tagWikiRepo.upsertTagWiki(db, {
    tag_name: tagName,
    body: entry.body,
    other_names_json: JSON.stringify(otherNames),
    fetched_at: Date.now()
  })

  return { tagName, body: entry.body, otherNames }
}
