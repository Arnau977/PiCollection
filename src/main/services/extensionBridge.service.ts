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
import { splitArtistCredits } from '@shared/utils'

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
  /** Ignored: captures always go to Pending. Still accepted from older extension builds. */
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
 * The artist is the one thing a capture links on its own: it's reliable when
 * the site credits exactly one. Several credits are left for the user to pick
 * from the source suggestions, since a media has a single artist.
 */
async function findSoleArtist(rawName: string | undefined): Promise<string | undefined> {
  const names = splitArtistCredits(rawName)
  if (names.length !== 1) return undefined
  return findExisting(names[0], await artistService.getAllArtists())?.id
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
    series: cleanNames(raw.series),
    sfw: input.sfw,
    isAiGenerated: input.isAiGenerated
  }
  const isEmpty =
    !metadata.artist &&
    metadata.sfw === undefined &&
    metadata.isAiGenerated === undefined &&
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

      // The extension is a quick inbox, not a tagging tool. Which of the
      // site's names the user wants (a parent series next to its child, a
      // base character next to its form, the site's rating) can't be told
      // from code, so everything is kept as source metadata and offered as
      // one-click suggestions when the media is reviewed. Only a sole
      // credited artist is linked right away.
      const artistId = await findSoleArtist(input.artistName)

      const created = await mediaService.addMedia(
        {
          name: input.fileName,
          type: input.mediaType,
          route: absolutePath,
          // Pending media is never shown in the gallery, so blurring it helped
          // nothing: it starts SFW like any other new media, and the site's
          // rating is offered as a hint when it's reviewed.
          sfw: true,
          isAiGenerated: false,
          artistId,
          tagIds: [],
          characterIds: [],
          seriesIds: [],
          // Always an inbox to review: `pendingTagging: false` from an older
          // extension build is ignored.
          pendingTagging: true,
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
