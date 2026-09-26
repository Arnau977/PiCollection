import { mkdir, unlink, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import { z } from 'zod'
import { AppError } from '../errors'
import { artistService } from './artist.service'
import { characterService } from './character.service'
import { mediaService } from './media.service'
import { readSourceFolder } from './sourceFolder'
import { seriesService } from './series.service'
import { tagService } from './tag.service'
import type { MediaSourceMetadata } from '@shared/models'

export type ExtensionBridgeLookupType = 'artist' | 'tag' | 'series' | 'character'

/**
 * Validates every incoming /capture request body - this is the sole
 * validation of external input reaching this HTTP API (see extensionBridge
 * .server.ts), matching the "validate at system boundaries" rule applied to
 * the IPC boundary elsewhere in this app.
 */
export const ExtensionBridgeCaptureInputSchema = z.object({
  fileDataBase64: z.string().min(1),
  fileName: z.string().min(1),
  mediaType: z.enum(['image', 'gif', 'video']),
  sourceUrl: z.string().regex(/^https?:\/\//, 'sourceUrl must be an http(s) URL'),
  sourceSite: z.string().min(1),
  artistName: z.string().optional(),
  tagNames: z.array(z.string().min(1)).optional(),
  characterNames: z.array(z.string().min(1)).optional(),
  seriesNames: z.array(z.string().min(1)).optional(),
  sfw: z.boolean().optional(),
  isAiGenerated: z.boolean().optional(),
  pendingTagging: z.boolean().optional(),
  /** Everything the site had, raw - stored as informational source metadata. */
  sourceMetadata: z
    .object({
      artist: z.string().optional(),
      tags: z.array(z.string()).default([]),
      characters: z.array(z.string()).default([]),
      series: z.array(z.string()).default([])
    })
    .optional()
})

export type ExtensionBridgeCaptureInput = z.infer<typeof ExtensionBridgeCaptureInputSchema>

export type ExtensionBridgeCaptureResult =
  | { status: 'created'; mediaId: string }
  | { status: 'duplicate'; mediaId: string }

const FALLBACK_EXTENSION: Record<ExtensionBridgeCaptureInput['mediaType'], string> = {
  image: '.jpg',
  gif: '.gif',
  video: '.mp4'
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

/**
 * `sourceSite` reaches this module as arbitrary attacker-controlled input
 * (the capture request body) and is used to build a filesystem path -
 * without sanitizing, a value like `../../../etc` would escape the intended
 * `Web Imports/` subtree. Same character-allowlist policy as
 * sanitizeFileName, just with a shorter cap since this is a directory
 * segment, not a filename.
 */
function sanitizeSiteName(site: string): string {
  return site.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'unknown'
}

/** Drops blank and whitespace-only entries; `.min(1)` on the schema already
 * rejects a literal empty string, this additionally catches things like
 * `"   "` that survive that check but are meaningless after trimming. */
function cleanNames(names?: string[]): string[] {
  return (names ?? []).map((n) => n.trim()).filter((n) => n.length > 0)
}

type Named = { id: string; name: string; aliases?: string[] }

interface MatchOptions {
  /** Also try the name without a trailing "(...)" qualifier - only safe for characters, where Danbooru's `sylphiette_(mushoku_tensei)` means `Sylphiette`; on general tags the qualifier is what tells e.g. `bow_(weapon)` apart from `bow`. */
  stripQualifier?: boolean
}

/** Booru underscores become spaces. */
function displayName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Booru sites write `closed_eyes` where the library has `Closed eyes` - names compare on a key that ignores case, underscores and spacing. */
function nameKey(name: string): string {
  return displayName(name).toLowerCase()
}

function keysOf(item: Named): string[] {
  return [item.name, ...(item.aliases ?? [])].map(nameKey)
}

/** Finds an existing entity by name or alias; with stripQualifier, falls back to the name minus its trailing "(...)". */
function findExisting<T extends Named>(name: string, all: T[], options: MatchOptions = {}): T | undefined {
  const key = nameKey(name)
  if (!key) return undefined
  const exact = all.find((item) => keysOf(item).includes(key))
  if (exact || !options.stripQualifier) return exact
  const bare = key.replace(/\s*\([^)]*\)$/, '').trim()
  if (!bare || bare === key) return undefined
  return all.find((item) => keysOf(item).includes(bare))
}

/**
 * A media has a single artist, but booru posts can credit several - the
 * extension sends them comma-joined. Links the first one already in the
 * library, or none.
 */
async function findExistingArtist(rawName: string): Promise<string | undefined> {
  const names = rawName
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
  if (names.length === 0) return undefined

  const all = await artistService.getAllArtists()
  for (const name of names) {
    const existing = findExisting(name, all)
    if (existing) return existing.id
  }
  return undefined
}

/**
 * Ids of the library entities these names match; unknown names are skipped.
 * Deduplicated: two names resolving to the same entity (repeats, case
 * variants, an alias) would otherwise trip the media_tag/media_character/
 * media_series composite primary key when addMedia links them.
 */
function findExistingIds<T extends Named>(
  names: string[],
  all: T[],
  options: MatchOptions = {}
): string[] {
  const ids: string[] = []
  for (const name of names) {
    const id = findExisting(name, all, options)?.id
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

/**
 * Older extension builds send no `sourceMetadata` - fall back to the names
 * they did send, so the ones that no longer get created aren't just lost.
 */
function toSourceMetadata(input: ExtensionBridgeCaptureInput): MediaSourceMetadata | undefined {
  const raw = input.sourceMetadata ?? {
    artist: input.artistName,
    tags: input.tagNames ?? [],
    characters: input.characterNames ?? [],
    series: input.seriesNames ?? []
  }
  const metadata: MediaSourceMetadata = {
    site: input.sourceSite,
    artist: raw.artist?.trim() || undefined,
    tags: cleanNames(raw.tags),
    characters: cleanNames(raw.characters),
    series: cleanNames(raw.series)
  }
  const isEmpty =
    !metadata.artist &&
    metadata.tags.length + metadata.characters.length + metadata.series.length === 0
  return isEmpty ? undefined : metadata
}

export const extensionBridgeService = {
  async lookup(
    type: ExtensionBridgeLookupType,
    query: string
  ): Promise<{ id: string; name: string; exact?: boolean }[]> {
    const all: Named[] =
      type === 'artist'
        ? await artistService.getAllArtists()
        : type === 'tag'
          ? await tagService.getAllTags()
          : type === 'series'
            ? await seriesService.getAllSeries()
            : await characterService.getAllCharacters()

    const key = nameKey(query)
    if (!key) return all.slice(0, 20).map((item) => ({ id: item.id, name: item.name }))

    // `exact` is the entity capture() would link this name to, so the
    // extension's "exists / new" badge agrees with what saving will do.
    const exact = findExisting(query, all, { stripQualifier: type === 'character' })
    const matches = all.filter((item) => item !== exact && keysOf(item).some((k) => k.includes(key)))
    const ordered = exact ? [exact, ...matches] : matches
    return ordered
      .slice(0, 20)
      .map((item) => ({ id: item.id, name: item.name, exact: item === exact }))
  },

  async capture(input: ExtensionBridgeCaptureInput): Promise<ExtensionBridgeCaptureResult> {
    const sourceFolder = readSourceFolder()
    if (!sourceFolder) {
      throw new AppError('NO_SOURCE_FOLDER', 'Configure a source folder in PiCollection first.')
    }

    const siteDir = join(sourceFolder, 'Web Imports', sanitizeSiteName(input.sourceSite))
    await mkdir(siteDir, { recursive: true })

    const extension = extname(input.fileName) || FALLBACK_EXTENSION[input.mediaType]
    const baseName = sanitizeFileName(
      input.fileName.slice(0, input.fileName.length - extname(input.fileName).length)
    )
    const absolutePath = join(siteDir, `${Date.now()}-${baseName}${extension}`)
    await writeFile(absolutePath, Buffer.from(input.fileDataBase64, 'base64'))

    try {
      const duplicateCheck = await mediaService.checkDuplicate(absolutePath)
      if (duplicateCheck.exactMatch) {
        // A clean duplicate response shouldn't turn into a 500 just because
        // the leftover file couldn't be removed.
        await unlink(absolutePath).catch(() => {})
        return { status: 'duplicate', mediaId: duplicateCheck.exactMatch.id }
      }

      // The extension is a quick inbox, not a tagging tool: it only links
      // names that already exist in the library and never creates entities.
      // Everything the site had is kept as source metadata instead, for the
      // user to pick from when they tag the media in the app.
      const artistId = input.artistName ? await findExistingArtist(input.artistName) : undefined
      const tagIds = findExistingIds(cleanNames(input.tagNames), await tagService.getAllTags())
      const characterIds = findExistingIds(
        cleanNames(input.characterNames),
        await characterService.getAllCharacters(),
        { stripQualifier: true }
      )
      const seriesIds = findExistingIds(
        cleanNames(input.seriesNames),
        await seriesService.getAllSeries()
      )

      const created = await mediaService.addMedia(
        {
          name: input.fileName,
          type: input.mediaType,
          route: absolutePath,
          sfw: input.sfw ?? true,
          isAiGenerated: input.isAiGenerated ?? false,
          artistId,
          tagIds,
          characterIds,
          seriesIds,
          pendingTagging: input.pendingTagging ?? true,
          sourceUrl: input.sourceUrl
        },
        { sourceMetadata: toSourceMetadata(input) }
      )

      return { status: 'created', mediaId: created.id }
    } catch (err) {
      // The file already landed on disk before this point - don't leave it
      // orphaned in the user's source folder if anything after that fails.
      await unlink(absolutePath).catch(() => {})
      throw err
    }
  }
}
